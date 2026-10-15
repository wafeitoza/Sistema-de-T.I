/**
 * Núcleo compartilhado das Functions — não vira rota.
 *
 * A Vercel ignora arquivos cujo nome começa com `_` dentro de `api/`, então
 * este módulo é importado mas não expõe endpoint.
 *
 * Por que existe: até aqui `api/usuarios.mjs` era a única Function e guardava
 * `config()`, `perfilDoToken()` e `auditar()` dentro de si. Com uma segunda
 * Function (Gmail/chamados) manter essas cópias significaria que uma correção
 * de segurança em uma delas não chegasse na outra — exatamente o tipo de
 * divergência que a varredura de segurança de 15/10/2026 acabou pegando no
 * controle de `trocar_senha`.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/** Credenciais do Supabase no servidor. `erro` quando falta env var. */
export function config() {
  const url = process.env.SUPABASE_URL
  const publica = process.env.SUPABASE_PUBLISHABLE_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !publica || !service) {
    return { erro: 'Supabase não configurado no servidor (env vars ausentes)' }
  }
  return { url, publica, service }
}

export async function lerJson(resposta) {
  const texto = await resposta.text()
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return { mensagem: texto }
  }
}

export function cabecalhosService(cfg) {
  return { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` }
}

/**
 * Devolve o perfil (com auth_id e `trocarSenha`) de quem enviou o token, ou null.
 *
 * `trocarSenha` vem do `user_metadata`, não de `usuarios`: a tela de troca
 * obrigatória é só cliente, então esta verificação é o que faz a regra valer
 * também para quem chama a API por fora (F-2, 15/10/2026).
 */
export async function perfilDoToken(cfg, token) {
  const resposta = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: { apikey: cfg.publica, Authorization: `Bearer ${token}` },
  })
  if (!resposta.ok) return null
  const user = await lerJson(resposta)
  if (!user?.email) return null

  const consulta = await fetch(
    `${cfg.url}/rest/v1/usuarios?email=eq.${encodeURIComponent(user.email)}&select=email,nome,perfil,status,auth_id`,
    { headers: cabecalhosService(cfg) },
  )
  const linhas = await lerJson(consulta)
  const perfil = Array.isArray(linhas) ? (linhas[0] ?? null) : null
  if (!perfil) return null
  return { ...perfil, trocarSenha: Boolean(user.user_metadata?.trocar_senha) }
}

/** Extrai o Bearer do header Authorization; null quando ausente. */
export function tokenDaRequisicao(req) {
  const bruto = req.headers.authorization ?? ''
  return bruto.startsWith('Bearer ') ? bruto.slice(7).trim() : null
}

/**
 * Grava uma linha em `auditoria` pelo servidor.
 *
 * Duas regras, herdadas de `api/usuarios.mjs`:
 *  - um campo sensível (senha, token, refresh token) NUNCA entra em `campos`;
 *  - falha de log vai para o log do servidor mas NÃO derruba a operação.
 *    Bloquear a ação por causa do registro seria pior, e o RLS append-only da
 *    `auditoria` já impede que quem chamou a API apague a própria trilha.
 *
 * O id usa a mesma sequência (`LOG`) e o mesmo formato do cliente, para os
 * dois fluxos continuarem numerados numa linha só.
 */
export async function auditar(cfg, entrada) {
  try {
    const seq = await fetch(`${cfg.url}/rest/v1/rpc/proxima_sequencia`, {
      method: 'POST',
      headers: { ...cabecalhosService(cfg), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_nome: 'LOG' }),
    })
    const numero = seq.ok ? await lerJson(seq) : null

    const resposta = await fetch(`${cfg.url}/rest/v1/auditoria`, {
      method: 'POST',
      headers: { ...cabecalhosService(cfg), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: `LOG-${new Date().getFullYear()}-${String(numero ?? Date.now()).padStart(6, '0')}`,
        usuario: entrada.usuario,
        acao: entrada.acao,
        tabela: entrada.tabela,
        registro_id: entrada.registroId,
        campos: entrada.campos ?? [],
        resultado: entrada.resultado,
        mensagem: entrada.mensagem ?? null,
      }),
    })
    if (!resposta.ok) {
      console.error(`[api/_lib] auditoria(${entrada.tabela}):`, resposta.status, await lerJson(resposta))
    }
  } catch (erro) {
    console.error(`[api/_lib] auditoria(${entrada.tabela}):`, erro)
  }
}

/** Reserva um bloco de sequência no servidor e devolve o topo. */
export async function reservarSequencia(cfg, nome, qtd = 50) {
  const resposta = await fetch(`${cfg.url}/rest/v1/rpc/reservar_sequencia`, {
    method: 'POST',
    headers: { ...cabecalhosService(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_nome: nome, p_qtd: qtd }),
  })
  if (!resposta.ok) return null
  return Number(await lerJson(resposta))
}

// -----------------------------------------------------------------------------
// Integração Google/Gmail
// -----------------------------------------------------------------------------

/**
 * Credenciais do app OAuth no Google Cloud.
 *
 * `redirectUri` vem de env var e não é deduzido do host da requisição: aceitar
 * o host que chegar permitiria que alguém apontasse o fluxo para outro lugar e
 * capturasse o `code`. Com o valor fixo em env var, a URI registrada no Google
 * e a usada aqui não podem divergir.
 */
export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  const chave = process.env.INTEGRACAO_CHAVE
  if (!clientId || !clientSecret || !redirectUri) {
    return { erro: 'Integração Gmail não configurada (env vars GOOGLE_* ausentes)' }
  }
  if (!chave || chave.length < 32) {
    return { erro: 'INTEGRACAO_CHAVE ausente ou curta demais (mínimo 32 caracteres)' }
  }
  return { clientId, clientSecret, redirectUri, chave }
}

/**
 * Cifra o refresh token antes de gravar (AES-256-GCM).
 *
 * Devolve `null` — e não grava nada — quando a chave não está configurada.
 * Falhar fechado aqui é de propósito: um refresh token do Gmail em claro no
 * banco valeria quanto a caixa de entrada de quem conectou, e gravar "por
 * enquanto sem cifra" para depois nunca acontece.
 */
export function cifrarSegredo(texto, chave) {
  try {
    const segredo = createHash('sha256').update(chave).digest()
    const iv = randomBytes(12)
    const cifra = createCipheriv('aes-256-gcm', segredo, iv)
    const dados = Buffer.concat([cifra.update(String(texto), 'utf8'), cifra.final()])
    const tag = cifra.getAuthTag()
    return [iv, tag, dados].map((b) => b.toString('base64')).join('.')
  } catch (erro) {
    console.error('[api/_lib] cifrarSegredo:', erro)
    return null
  }
}

export function decifrarSegredo(gravado, chave) {
  try {
    const [iv, tag, dados] = String(gravado ?? '').split('.').map((p) => Buffer.from(p, 'base64'))
    if (!iv || !tag || !dados) return null
    const segredo = createHash('sha256').update(chave).digest()
    const decifra = createDecipheriv('aes-256-gcm', segredo, iv)
    decifra.setAuthTag(tag)
    return Buffer.concat([decifra.update(dados), decifra.final()]).toString('utf8')
  } catch {
    // chave trocada ou registro corrompido: devolve null em vez de estourar
    return null
  }
}

/**
 * Troca o refresh token por um access token de curta duração.
 *
 * Este é o único lugar que conversa com o token endpoint do Google. O refresh
 * token nunca sai do servidor.
 */
export async function tokenDeAcessoGoogle(google, refreshToken) {
  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: google.clientId,
      client_secret: google.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!resposta.ok) {
    console.error('[api/_lib] tokenGoogle:', resposta.status, await lerJson(resposta))
    return null
  }
  const dados = await lerJson(resposta)
  return dados?.access_token ?? null
}

/** Escopos pedidos na autorização (leitura + resposta + mover para a lixeira). */
export const ESCOPOS_GMAIL = [
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ')
