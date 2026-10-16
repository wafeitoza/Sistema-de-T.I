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
 * nunca duplica — vale também para o Vercel Cron (`api/cron-sincronizar.mjs`),
 * que dispara a mesma rotina de `_gmail.mjs` sem passar por aqui.
 *
 * POST /api/chamados  { acao: 'status' }                      → estado da conexão
 *                   { acao: 'sincronizar' }                   → importação
 *                   { acao: 'responder', chamadoId, texto }   → resposta no fio
 *                   { acao: 'definirFiltro', filtro }         → o que vira chamado
 */
import {
  auditar,
  cabecalhosService,
  config,
  googleConfig,
  lerJson,
  perfilDoToken,
  tokenDaRequisicao,
  tokenDeAcessoGoogle,
} from './_lib.mjs'
import { chamarGmail, geradorIds, gravar, integracaoAtiva, sincronizar } from './_gmail.mjs'

/** Perfis que operam chamados — espelha `pode_editar()` do RLS. */
const PERFIS_QUE_OPERAM = ['Admin', 'Gerente', 'Técnico']

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
