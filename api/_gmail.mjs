/**
 * Núcleo da integração com o Gmail — não vira rota (prefixo `_`).
 *
 * A sincronização passou a ter dois gatilhos: o clique em "Sincronizar agora"
 * (`api/chamados.mjs`) e o agendador do GitHub Actions
 * (`api/cron-sincronizar.mjs`). Manter a
 * lógica em cada um deles faria o importador divergir — o mesmo tipo de cópia
 * que motivou `api/_lib.mjs` e que a varredura de segurança de 15/10/2026
 * pegou no controle de `trocar_senha`.
 *
 * A conversão de e-mail em chamado continua protegida pela dedupe do banco
 * (`chamados.email_mensagem_id` e `chamado_mensagens.email_id` com índice
 * único parcial): dois gatilhos rodando no mesmo minuto não duplicam nada —
 * o segundo recebe 23505/409 e segue.
 */
import {
  auditar,
  cabecalhosService,
  decifrarSegredo,
  lerJson,
  reservarSequencia,
  tokenDeAcessoGoogle,
} from './_lib.mjs'

const URL_GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'

/** Conexão vigente, com o refresh token já decifrado. `null` quando não há. */
export async function integracaoAtiva(cfg, google) {
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

export async function chamarGmail(access, metodo, caminho, corpo) {
  const resposta = await fetch(`${URL_GMAIL}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const dados = await lerJson(resposta)
  if (!resposta.ok) {
    // 401 = access token expirado ou revogado; a mensagem orienta a reconectar
    console.error('[api/_gmail] gmail', metodo, caminho, resposta.status, dados?.error?.status ?? '')
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
export function geradorIds(cfg, prefixo) {
  const ano = new Date().getFullYear()
  // O 1 inicial é proposital (bug medido em 19/10/2026): começando em 0 com
  // limite 0, a condição `proximo > limite` era falsa na PRIMEIRA chamada — o
  // gerador emitia `-000000` sem reservar bloco. Naquela sincronização o
  // primeiro chamado nasceu `CHM-2026-000000`; e, com ele já existindo, a
  // primeira chamada de toda sincronização seguinte voltaria a gerar 000000,
  // o insert bateria em 409 e a dedupe (tolerante a 409) engoliria o e-mail
  // inteiro — o primeiro e-mail novo de cada execução nunca viraria chamado.
  // Com proximo=1 e limite=0 a primeira chamada SEMPRE reserva bloco.
  let proximo = 1
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

export async function gravar(cfg, tabela, registro) {
  const resposta = await fetch(`${cfg.url}/rest/v1/${tabela}`, {
    method: 'POST',
    headers: { ...cabecalhosService(cfg), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(registro),
  })
  // 23505 = já importada numa passagem anterior; a dedupe é do banco
  if (!resposta.ok && resposta.status !== 23505 && resposta.status !== 409) {
    console.error('[api/_gmail] gravar', tabela, resposta.status, await lerJson(resposta))
    return false
  }
  return true
}

/**
 * Importa a caixa conectada: cada e-mail do filtro vira chamado (se o fio é
 * novo) ou mensagem do fio existente. `chamador` identifica quem disparou —
 * a tela passa o usuário; o cron passa `{ email: 'sistema' }`.
 */
export async function sincronizar(cfg, google, chamador) {
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
      console.error('[api/_gmail] detalhe', id, detalhe.erro)
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
