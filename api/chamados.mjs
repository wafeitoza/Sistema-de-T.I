/**
 * Chamados integrados ao Gmail — só executa no servidor da Vercel.
 *
 * A sincronização lê a caixa conectada (o refresh token fica cifrado em
 * `integracoes` e nunca sai daqui) e converte e-mail em chamado:
 *
 *   - e-mail de um fio que ainda não tem chamado  → cria chamado 'Aberto';
 *   - resposta num fio que já tem chamado         → anexa a mensagem ao fio e,
 *     se o chamado estava 'Aguardando usuário', devolve para 'Em atendimento'
 *     (quem abriu respondeu; deixar parado em "aguardando" mentiria sobre o
 *     tempo de resposta).
 *
 * A dedupe não depende de a sincronização dar certo de ponta a ponta: tanto
 * `chamados.email_mensagem_id` quanto `chamado_mensagens.email_id` têm índice
 * único parcial no banco. Um crash no meio importa o resto na próxima vez e
 * nunca duplica.
 *
 * POST /api/chamados  { acao: 'status' }                      → estado da conexão
 *                   { acao: 'sincronizar' }                   → importação
 *                   { acao: 'responder', chamadoId, texto }   → resposta no fio
 *                   { acao: 'definirFiltro', filtro }         → o que vira chamado
 */
import {
  auditar,
  config,
  decifrarSegredo,
  googleConfig,
  lerJson,
  perfilDoToken,
  reservarSequencia,
  tokenDaRequisicao,
  tokenDeAcessoGoogle,
} from './_lib.mjs'

/** Perfis que operam chamados — espelha `pode_editar()` do RLS. */
const PERFIS_QUE_OPERAM = ['Admin', 'Gerente', 'Técnico']

const URL_GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'

function cabecalhosService(cfg) {
  return { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` }
}

/** Conexão vigente, com o refresh token já decifrado. `null` quando não há. */
async function integracaoAtiva(cfg, google) {
  const resposta = await fetch(`${cfg.url}/rest/v1/integracoes?id=eq.gmail&select=*`, {
    headers: cabecalhosService(cfg),
  })
  const linhas = await lerJson(resposta)
  const linha = Array.isArray(linhas) ? linhas[0] : null
  if (!linha) return null

  const token = decifrarSegredo(linha.segredo_cifrado, google.chave)
  if (!token) return { erro: 'Credencial guardada não pôde ser lida (INTEGRACAO_CHAVE mudou?)' }

  return {
    conta: linha.conta,
    filtro: linha.filtro || 'in:inbox newer_than:7d',
    ultimaSincronizacao: linha.ultima_sincronizacao ?? null,
    refreshToken: token,
  }
}

async function chamarGmail(access, metodo, caminho, corpo) {
  const resposta = await fetch(`${URL_GMAIL}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const dados = await lerJson(resposta)
  if (!resposta.ok) {
    // 401 = access token expirou ou revogado; a mensagem orienta a reconectar
    console.error('[api/chamados] gmail', metodo, caminho, resposta.status, dados?.error?.status ?? '')
    return { erro: resposta.status === 401 ? 'sessao' : 'api', dados }
  }
  return { dados }
}

function cabecalho(payload, nome) {
  const achado = (payload?.headers ?? []).find(
    (h) => String(h?.name ?? '').toLowerCase() === nome.toLowerCase(),
  )
  return String(achado?.value ?? '').trim()
}

/** Texto legível da mensagem. Prefere text/plain; cai no HTML sem etiquetas. */
function textoDaMensagem(payload, profundidade = 0) {
  if (!payload || profundidade > 6) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8').trim()
  }
  for (const parte of payload.parts ?? []) {
    const texto = textoDaMensagem(parte, profundidade + 1)
    if (texto) return texto
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url')
      .toString('utf8')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return ''
}

/** Gerador de ids na mesma forma do app (`CHM-2026-000001`), em bloco. */
function geradorIds(cfg, prefixo) {
  const ano = new Date().getFullYear()
  let proximo = 0
  let limite = 0
  return async () => {
    if (proximo > limite) {
      const topo = await reservarSequencia(cfg, prefixo, 50)
      if (!topo) return null
      limite = topo
      proximo = topo - 49
    }
    const valor = proximo++
    return `${prefixo}-${ano}-${String(valor).padStart(6, '0')}`
  }
}

async function gravar(cfg, tabela, registro) {
  const resposta = await fetch(`${cfg.url}/rest/v1/${tabela}`, {
    method: 'POST',
    headers: { ...cabecalhosService(cfg), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(registro),
  })
  // 23505 = já importada numa passagem anterior; a dedupe é do banco
  if (!resposta.ok && resposta.status !== 23505 && resposta.status !== 409) {
    console.error('[api/chamados] gravar', tabela, resposta.status, await lerJson(resposta))
    return false
  }
  return true
}

async function sincronizar(cfg, google, chamador) {
  const conexao = await integracaoAtiva(cfg, google)
  if (conexao?.erro) return { status: 500, corpo: { erro: conexao.erro } }
  if (!conexao) return { status: 400, corpo: { erro: 'Nenhuma caixa de e-mail conectada' } }

  const access = await tokenDeAcessoGoogle(google, conexao.refreshToken)
  if (!access) {
    return { status: 401, corpo: { erro: 'A autorização do Gmail expirou. Conecte a caixa novamente.' } }
  }

  // já importados — para não relevar o que já está no sistema
  const [mensagensExistentes, chamadosExistentes] = await Promise.all([
    fetch(`${cfg.url}/rest/v1/chamado_mensagens?select=email_id`, { headers: cabecalhosService(cfg) })
      .then(lerJson)
      .then((l) => new Set((Array.isArray(l) ? l : []).map((x) => x.email_id).filter(Boolean))),
    fetch(`${cfg.url}/rest/v1/chamados?select=id,email_thread_id,status,atribuido_a,solicitante`, {
      headers: cabecalhosService(cfg),
    })
      .then(lerJson)
      .then((l) => (Array.isArray(l) ? l : [])),
  ])

  const porFio = new Map(
    chamadosExistentes.filter((c) => c.email_thread_id).map((c) => [c.email_thread_id, c]),
  )

  const lista = await chamarGmail(
    access,
    'GET',
    `/messages?${new URLSearchParams({ q: conexao.filtro, maxResults: '50' })}`,
  )
  if (lista.erro) {
    return {
      status: lista.erro === 'sessao' ? 401 : 502,
      corpo: {
        erro:
          lista.erro === 'sessao'
            ? 'A autorização do Gmail expirou. Conecte a caixa novamente.'
            : 'O Gmail recusou a leitura da caixa',
      },
    }
  }

  const ids = (lista.dados?.messages ?? []).map((m) => m.id).filter((id) => !mensagensExistentes.has(id))
  const novoIdChamado = geradorIds(cfg, 'CHM')
  const novoIdMensagem = geradorIds(cfg, 'CMM')

  let chamadosCriados = 0
  let mensagensAnexadas = 0
  let ignoradas = 0

  for (const id of ids) {
    const detalhe = await chamarGmail(access, 'GET', `/messages/${id}?format=full`)
    if (detalhe.erro) {
      console.error('[api/chamados] detalhe', id, detalhe.erro)
      ignoradas++
      continue
    }

    const msg = detalhe.dados ?? {}
    const remetente = cabecalho(msg.payload, 'From')
    const destinatarios = cabecalho(msg.payload, 'To')
    const assunto = cabecalho(msg.payload, 'Subject') || '(sem assunto)'
    const corpo = textoDaMensagem(msg.payload)
    const recebidoEm = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString()

    // e-mail que o próprio sistema enviou não abre chamado nem anexa de novo
    const emailRemetente = /<([^>]+)>/.exec(remetente)?.[1] ?? remetente
    const eNossa = emailRemetente.toLowerCase() === conexao.conta.toLowerCase()
    if (eNossa) {
      ignoradas++
      continue
    }

    const idMensagem = await novoIdMensagem()
    if (!idMensagem) return { status: 502, corpo: { erro: 'Não foi possível numerar as mensagens (sequência CMM)' } }

    const pai = porFio.get(msg.threadId)

    if (pai) {
      const gravou = await gravar(cfg, 'chamado_mensagens', {
        id: idMensagem,
        chamado_id: pai.id,
        direcao: 'recebida',
        remetente,
        destinatarios,
        assunto,
        corpo,
        email_id: msg.id,
        recebido_em: recebidoEm,
      })
      if (!gravou) {
        ignoradas++
        continue
      }
      mensagensAnexadas++

      // o solicitante respondeu: sai de "aguardando usuário"
      if (pai.status === 'Aguardando usuário') {
        await fetch(`${cfg.url}/rest/v1/chamados?id=eq.${encodeURIComponent(pai.id)}`, {
          method: 'PATCH',
          headers: { ...cabecalhosService(cfg), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'Em atendimento' }),
        })
      }
      continue
    }

    const idChamado = await novoIdChamado()
    if (!idChamado) return { status: 502, corpo: { erro: 'Não foi possível numerar os chamados (sequência CHM)' } }

    const criou = await gravar(cfg, 'chamados', {
      id: idChamado,
      assunto: assunto.slice(0, 200),
      descricao: corpo.slice(0, 4000) || null,
      solicitante: emailRemetente || conexao.conta,
      origem: 'E-mail',
      prioridade: 'Média',
      status: 'Aberto',
      email_thread_id: msg.threadId ?? null,
      email_mensagem_id: msg.id,
      email_url: msg.threadId ? `https://mail.google.com/mail/u/0/#all/${msg.threadId}` : null,
      registrado_por: chamador.email,
    })
    if (!criou) {
      ignoradas++
      continue
    }

    await gravar(cfg, 'chamado_mensagens', {
      id: idMensagem,
      chamado_id: idChamado,
      direcao: 'recebida',
      remetente,
      destinatarios,
      assunto,
      corpo,
      email_id: msg.id,
      recebido_em: recebidoEm,
    })

    porFio.set(msg.threadId, { id: idChamado, status: 'Aberto', solicitante: emailRemetente })
    chamadosCriados++
  }

  await fetch(`${cfg.url}/rest/v1/integracoes?id=eq.gmail`, {
    method: 'PATCH',
    headers: { ...cabecalhosService(cfg), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ultima_sincronizacao: new Date().toISOString() }),
  })

  await auditar(cfg, {
    usuario: chamador.email,
    tabela: 'CHAMADOS',
    acao: 'IMPORT',
    registroId: 'sincronização gmail',
    resultado: 'Sucesso',
    campos: [
      { campo: 'chamados_criados', antes: null, depois: chamadosCriados },
      { campo: 'mensagens_anexadas', antes: null, depois: mensagensAnexadas },
      { campo: 'ignoradas', antes: null, depois: ignoradas },
    ],
    mensagem: `Sincronização do Gmail: ${chamadosCriados} chamado(s), ${mensagensAnexadas} mensagem(ns)`,
  })

  return { status: 200, corpo: { chamadosCriados, mensagensAnexadas, ignoradas, filtro: conexao.filtro } }
}

async function responder(cfg, google, chamador, corpo) {
  const chamadoId = String(corpo.chamadoId ?? '').trim()
  const texto = String(corpo.texto ?? '').trim()
  if (!chamadoId) return { status: 400, corpo: { erro: 'Chamado não informado' } }
  if (texto.length < 2) return { status: 400, corpo: { erro: 'Escreva a resposta' } }

  const conexao = await integracaoAtiva(cfg, google)
  if (conexao?.erro) return { status: 500, corpo: { erro: conexao.erro } }
  if (!conexao) return { status: 400, corpo: { erro: 'Nenhuma caixa de e-mail conectada' } }

  const consulta = await fetch(`${cfg.url}/rest/v1/chamados?id=eq.${encodeURIComponent(chamadoId)}&select=*`, {
    headers: cabecalhosService(cfg),
  })
  const linhas = await lerJson(consulta)
  const chamado = Array.isArray(linhas) ? linhas[0] : null
  if (!chamado) return { status: 404, corpo: { erro: 'Chamado não encontrado' } }

  const access = await tokenDeAcessoGoogle(google, conexao.refreshToken)
  if (!access) {
    return { status: 401, corpo: { erro: 'A autorização do Gmail expirou. Conecte a caixa novamente.' } }
  }

  // a resposta vai para quem abriu o chamado; sem fio no Gmail (chamado
  // manual) é um e-mail novo, o que ainda assim mantém a conversa fora do
  // sistema legível para quem abriu.
  const para = chamado.solicitante
  const assunto = `Re: ${chamado.assunto}`
  const linhasMime = [
    `From: ${conexao.conta}`,
    `To: ${para}`,
    `Subject: ${assunto}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    texto,
  ]

  const envio = await chamarGmail(access, 'POST', '/messages/send', {
    raw: Buffer.from(linhasMime.join('\r\n'), 'utf8').toString('base64url'),
    ...(chamado.email_thread_id ? { threadId: chamado.email_thread_id } : {}),
  })
  if (envio.erro) {
    return {
      status: envio.erro === 'sessao' ? 401 : 502,
      corpo: { erro: envio.erro === 'sessao' ? 'A autorização do Gmail expirou.' : 'O Gmail recusou o envio' },
    }
  }

  const idMensagem = await geradorIds(cfg, 'CMM')()
  await gravar(cfg, 'chamado_mensagens', {
    id: idMensagem,
    chamado_id: chamado.id,
    direcao: 'enviada',
    remetente: conexao.conta,
    destinatarios: para,
    assunto,
    corpo: texto,
    email_id: envio.dados?.id ?? null,
    recebido_em: new Date().toISOString(),
  })

  await auditar(cfg, {
    usuario: chamador.email,
    tabela: 'CHAMADOS',
    acao: 'UPDATE',
    registroId: chamado.id,
    resultado: 'Sucesso',
    campos: [{ campo: 'resposta_enviada', antes: null, depois: para }],
    mensagem: 'Resposta enviada pelo Gmail',
  })

  return { status: 200, corpo: { enviado: true, para } }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const cfg = config()
  if (cfg.erro) return res.status(500).json({ erro: cfg.erro })

  const google = googleConfig()
  if (google.erro) return res.status(500).json({ erro: google.erro })

  const token = tokenDaRequisicao(req)
  if (!token) return res.status(401).json({ erro: 'Sessão ausente' })

  const chamador = await perfilDoToken(cfg, token)
  if (!chamador) return res.status(401).json({ erro: 'Sessão inválida' })
  if (chamador.status !== 'Ativo') return res.status(403).json({ erro: 'Usuário inativo' })
  if (chamador.trocarSenha) {
    return res.status(403).json({ erro: 'Sua senha ainda é a provisória. Troque-a antes de usar chamados.' })
  }
  if (!PERFIS_QUE_OPERAM.includes(chamador.perfil)) {
    // tentativa negada entra no log, igual à gestão de usuários
    await auditar(cfg, {
      usuario: chamador.email,
      tabela: 'CHAMADOS',
      acao: 'UPDATE',
      registroId: String(req.body?.acao ?? '—'),
      resultado: 'Erro',
      mensagem: `acesso negado — perfil ${chamador.perfil}`,
    })
    return res.status(403).json({ erro: 'Seu perfil não opera chamados' })
  }

  const corpo = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const acao = String(corpo.acao ?? '')

  try {
    if (acao === 'status') {
      const conexao = await integracaoAtiva(cfg, google)
      if (conexao?.erro) return res.status(500).json({ erro: conexao.erro })
      return res.status(200).json({
        conectado: Boolean(conexao),
        conta: conexao?.conta ?? null,
        filtro: conexao?.filtro ?? null,
        ultimaSincronizacao: conexao?.ultimaSincronizacao ?? null,
      })
    }

    if (acao === 'definirFiltro') {
      const filtro = String(corpo.filtro ?? '').trim()
      if (filtro.length > 300) return res.status(400).json({ erro: 'Filtro longo demais' })
      const conexao = await integracaoAtiva(cfg, google)
      if (!conexao) return res.status(400).json({ erro: 'Nenhuma caixa de e-mail conectada' })
      await fetch(`${cfg.url}/rest/v1/integracoes?id=eq.gmail`, {
        method: 'PATCH',
        headers: { ...cabecalhosService(cfg), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ filtro: filtro || 'in:inbox newer_than:7d' }),
      })
      await auditar(cfg, {
        usuario: chamador.email,
        tabela: 'INTEGRACOES',
        acao: 'UPDATE',
        registroId: 'gmail',
        resultado: 'Sucesso',
        campos: [{ campo: 'filtro', antes: conexao.filtro, depois: filtro }],
        mensagem: 'Filtro de sincronização alterado',
      })
      return res.status(200).json({ filtro: filtro || 'in:inbox newer_than:7d' })
    }

    if (acao === 'sincronizar') {
      const r = await sincronizar(cfg, google, chamador)
      return res.status(r.status).json(r.corpo)
    }

    if (acao === 'responder') {
      const r = await responder(cfg, google, chamador, corpo)
      return res.status(r.status).json(r.corpo)
    }

    return res.status(400).json({ erro: 'Ação desconhecida' })
  } catch (erro) {
    console.error('[api/chamados] erro inesperado:', erro)
    await auditar(cfg, {
      usuario: chamador.email,
      tabela: 'CHAMADOS',
      acao: 'UPDATE',
      registroId: acao || '—',
      resultado: 'Erro',
      mensagem: 'exceção não tratada na API',
    })
    return res.status(500).json({ erro: 'Erro interno ao processar chamados' })
  }
}
