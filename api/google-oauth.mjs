/**
 * Fluxo OAuth do Gmail — só executa no servidor da Vercel.
 *
 * O refresh token do Gmail vale quanto à caixa inteira de quem conectou, então
 * o desenho aqui é mais cuidadoso que um redirect ingênuo:
 *
 *  - a iniciação é um POST autenticado (Bearer do Supabase). Um redirect de
 *    navegador não consegue mandar header, e pôr o token do Supabase na query
 *    deixaria ele no histórico do navegador e nos logs do servidor;
 *  - o POST devolve a URL do Google já com um `state` assinado (HMAC-SHA256)
 *    contendo o e-mail de quem conectou e validade de 10 minutos. É ao mesmo
 *    tempo a proteção contra CSRF que o OAuth exige e o meio de saber, no
 *    callback, a quem gravar o token — sem nenhum segredo na URL;
 *  - o refresh token é CIFRADO antes de ir para o banco (`INTEGRACAO_CHAVE`)
 *    e nunca volta ao navegador;
 *  - nada aqui loga o `code` ou os tokens.
 *
 * POST /api/google-oauth  { acao: 'iniciar' }  → { url }
 * GET  /api/google-oauth?code=...&state=...   → 302 para /chamados
 */
import {
  auditar,
  cifrarSegredo,
  config,
  googleConfig,
  lerJson,
  perfilDoToken,
  tokenDaRequisicao,
  ESCOPOS_GMAIL,
} from './_lib.mjs'
import { createHmac, timingSafeEqual } from 'node:crypto'

const TTL_STATE_MS = 10 * 60 * 1000

function assinarState(chave, payload) {
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const assinatura = createHmac('sha256', chave).update(corpo).digest('base64url')
  return `${corpo}.${assinatura}`
}

function verificarState(chave, state) {
  const [corpo, assinatura] = String(state ?? '').split('.')
  if (!corpo || !assinatura) return null

  const esperada = createHmac('sha256', chave).update(corpo).digest()
  const recebida = Buffer.from(assinatura, 'base64url')
  // comprimento igual antes do compare: `timingSafeEqual` lança se divergir
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null

  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'))
    if (!payload?.email || typeof payload.exp !== 'number') return null
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function urlDeAutorizacao(google, state) {
  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: google.redirectUri,
    response_type: 'code',
    scope: ESCOPOS_GMAIL,
    state,
    // sem `prompt=consent`: num app publicado o Google reaproveita o
    // consentimento dado antes; o `access_type=offline` é o que garante o
    // refresh token na primeira vez.
    access_type: 'offline',
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** Grava (ou atualiza) a conexão, com o token cifrado. */
async function gravarIntegracao(cfg, google, email, refreshToken, escopos) {
  const cifrado = cifrarSegredo(refreshToken, google.chave)
  if (!cifrado) {
    return { status: 500, corpo: { erro: 'Não foi possível proteger a credencial (INTEGRACAO_CHAVE)' } }
  }

  const resposta = await fetch(`${cfg.url}/rest/v1/integracoes`, {
    method: 'POST',
    headers: {
      apikey: cfg.service,
      Authorization: `Bearer ${cfg.service}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: 'gmail',
      conta: email,
      segredo_cifrado: cifrado,
      escopos: escopos ?? null,
    }),
  })
  if (!resposta.ok) {
    console.error('[api/google-oauth] gravar integração:', resposta.status, await lerJson(resposta))
    return { status: 502, corpo: { erro: 'Não foi possível salvar a conexão' } }
  }
  return { status: 200, corpo: { email } }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const cfg = config()
  if (cfg.erro) return res.status(500).json({ erro: cfg.erro })

  const google = googleConfig()
  if (google.erro) return res.status(500).json({ erro: google.erro })

  // ---------------------------------------------------------------- callback
  if (req.method === 'GET') {
    const { code, state, error } = req.query ?? {}

    if (error) {
      // o usuário recusou a autorização no Google — não é erro do sistema
      return res.redirect(302, '/chamados?gmail=cancelado')
    }

    const payload = verificarState(google.chave, state)
    if (!payload) {
      return res.redirect(302, '/chamados?gmail=erro')
    }
    if (!code) return res.redirect(302, '/chamados?gmail=erro')

    const troca = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: google.clientId,
        client_secret: google.clientSecret,
        code: String(code),
        redirect_uri: google.redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await lerJson(troca)
    if (!troca.ok || !tokens?.refresh_token) {
      // sem `refresh_token` o Google só devolve na primeira autorização (ou
      // com `prompt=consent`); reportar isso evita uma "conexão" que morre
      // na primeira troca de access token.
      console.error('[api/google-oauth] troca de código:', troca.status, tokens?.error ?? 'sem refresh_token')
      return res.redirect(302, '/chamados?gmail=erro')
    }

    const gravado = await gravarIntegracao(cfg, google, payload.email, tokens.refresh_token, tokens.scope)
    if (gravado.status >= 400) return res.redirect(302, '/chamados?gmail=erro')

    await auditar(cfg, {
      usuario: payload.email,
      tabela: 'INTEGRACOES',
      acao: 'CREATE',
      registroId: 'gmail',
      resultado: 'Sucesso',
      // o token NUNCA entra aqui; só quem conectou e os escopos concedidos
      campos: [{ campo: 'conta', antes: null, depois: payload.email }],
      mensagem: 'Caixa de e-mail conectada ao sistema',
    })

    return res.redirect(302, '/chamados?gmail=conectado')
  }

  // ------------------------------------------------------------ iniciação
  if (req.method === 'POST') {
    const token = tokenDaRequisicao(req)
    if (!token) return res.status(401).json({ erro: 'Sessão ausente' })

    const chamador = await perfilDoToken(cfg, token)
    if (!chamador) return res.status(401).json({ erro: 'Sessão inválida' })
    if (chamador.status !== 'Ativo') {
      return res.status(403).json({ erro: 'Apenas usuários ativos conectam a caixa de e-mail' })
    }
    if (chamador.trocarSenha) {
      return res.status(403).json({
        erro: 'Sua senha ainda é a provisória. Troque-a antes de conectar o e-mail.',
      })
    }

    const state = assinarState(google.chave, {
      email: chamador.email,
      exp: Date.now() + TTL_STATE_MS,
    })

    await auditar(cfg, {
      usuario: chamador.email,
      tabela: 'INTEGRACOES',
      acao: 'CREATE',
      registroId: 'gmail',
      resultado: 'Sucesso',
      campos: [],
      mensagem: 'Autorização do Gmail iniciada',
    })

    return res.status(200).json({ url: urlDeAutorizacao(google, state) })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ erro: 'Método não permitido' })
}
