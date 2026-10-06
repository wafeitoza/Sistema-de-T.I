/**
 * Gestão de contas (Supabase Auth) — só executa no servidor da Vercel.
 *
 * Por que existe: criar/redefinir/excluir usuário exige a chave `service_role`,
 * que NUNCA pode ir para o bundle do navegador. Aqui ela fica em env var.
 *
 * Segurança: antes de qualquer coisa, o chamador precisa mandar o access token
 * de uma sessão válida e o perfil dele em `usuarios` precisa ser Admin/Ativo.
 *
 * POST /api/usuarios
 *   { acao: 'criar',    nome, email, perfil, setor }  → { email, senhaProvisoria }
 *   { acao: 'redefinir', email }                      → { email, senhaProvisoria }
 */
const PERFIS = ['Admin', 'Gerente', 'Técnico', 'Visualizador']
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function config() {
  const url = process.env.SUPABASE_URL
  const publica = process.env.SUPABASE_PUBLISHABLE_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !publica || !service) {
    return { erro: 'Supabase não configurado no servidor (env vars ausentes)' }
  }
  return { url, publica, service }
}

async function lerJson(resposta) {
  const texto = await resposta.text()
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return { mensagem: texto }
  }
}

function senhaProvisoria() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const numeros = '23456789'
  const tudo = letras + letras.toLowerCase() + numeros
  const sorteio = (fonte, n) =>
    Array.from({ length: n }, () => fonte[crypto.getRandomValues(new Uint32Array(1))[0] % fonte.length]).join('')
  return `Itstock-${sorteio(letras, 2)}${sorteio(numeros, 4)}${sorteio(tudo, 4)}`
}

/** Devolve o perfil (com auth_id) de quem enviou o token, ou null. */
async function perfilDoToken(cfg, token) {
  const resposta = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: { apikey: cfg.publica, Authorization: `Bearer ${token}` },
  })
  if (!resposta.ok) return null
  const user = await lerJson(resposta)
  if (!user?.email) return null

  const consulta = await fetch(
    `${cfg.url}/rest/v1/usuarios?email=eq.${encodeURIComponent(user.email)}&select=email,nome,perfil,status,auth_id`,
    { headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` } },
  )
  const linhas = await lerJson(consulta)
  return Array.isArray(linhas) ? linhas[0] ?? null : null
}

async function criar(cfg, corpo) {
  const nome = String(corpo.nome ?? '').trim()
  const email = String(corpo.email ?? '').trim().toLowerCase()
  const perfil = String(corpo.perfil ?? '').trim()
  const setor = String(corpo.setor ?? '').trim()

  if (!nome) return { status: 400, corpo: { erro: 'Nome é obrigatório' } }
  if (!RE_EMAIL.test(email)) return { status: 400, corpo: { erro: 'E-mail inválido' } }
  if (!PERFIS.includes(perfil)) return { status: 400, corpo: { erro: 'Perfil inválido' } }
  if (!setor) return { status: 400, corpo: { erro: 'Setor é obrigatório' } }

  const senha = senhaProvisoria()
  const auth = await fetch(`${cfg.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: cfg.service,
      Authorization: `Bearer ${cfg.service}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, trocar_senha: true },
    }),
  })
  const dadosAuth = await lerJson(auth)
  if (!auth.ok) {
    const mensagem = String(dadosAuth?.msg ?? dadosAuth?.message ?? '')
    if (auth.status === 422 || mensagem.toLowerCase().includes('already')) {
      return { status: 409, corpo: { erro: 'Já existe uma conta com este e-mail' } }
    }
    console.error('[api/usuarios] createUser:', auth.status, mensagem)
    return { status: 502, corpo: { erro: 'Não foi possível criar a conta no Supabase' } }
  }

  const perfilResposta = await fetch(`${cfg.url}/rest/v1/usuarios`, {
    method: 'POST',
    headers: {
      apikey: cfg.service,
      Authorization: `Bearer ${cfg.service}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ email, nome, perfil, setor, status: 'Ativo', auth_id: dadosAuth.id }),
  })
  if (!perfilResposta.ok) {
    const erro = await lerJson(perfilResposta)
    console.error('[api/usuarios] insert perfil:', perfilResposta.status, erro)
    // não deixa conta órfã: tenta reverter
    await fetch(`${cfg.url}/auth/v1/admin/users/${dadosAuth.id}`, {
      method: 'DELETE',
      headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` },
    })
    return { status: 502, corpo: { erro: 'Conta criada mas o perfil falhou; nada foi mantido' } }
  }

  return { status: 200, corpo: { email, senhaProvisoria: senha } }
}

async function redefinir(cfg, corpo, chamador) {
  const email = String(corpo.email ?? '').trim().toLowerCase()
  if (!RE_EMAIL.test(email)) return { status: 400, corpo: { erro: 'E-mail inválido' } }

  const consulta = await fetch(
    `${cfg.url}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=auth_id`,
    { headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` } },
  )
  const linhas = await lerJson(consulta)
  const authId = Array.isArray(linhas) ? linhas[0]?.auth_id : null
  if (!authId) {
    return { status: 404, corpo: { erro: 'Usuário ainda não tem conta de acesso' } }
  }

  const senha = senhaProvisoria()
  const resposta = await fetch(`${cfg.url}/auth/v1/admin/users/${authId}`, {
    // GoTrue só aceita PUT para atualizar; PATCH devolve 405
    method: 'PUT',
    headers: {
      apikey: cfg.service,
      Authorization: `Bearer ${cfg.service}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      password: senha,
      user_metadata: { trocar_senha: true },
      email_confirm: true,
    }),
  })
  if (!resposta.ok) {
    const erro = await lerJson(resposta)
    console.error('[api/usuarios] updateUser:', resposta.status, erro)
    return { status: 502, corpo: { erro: 'Não foi possível redefinir a senha' } }
  }

  return { status: 200, corpo: { email, senhaProvisoria: senha, por: chamador.email } }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const cfg = config()
  if (cfg.erro) return res.status(500).json({ erro: cfg.erro })

  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ erro: 'Sessão ausente' })

  const chamador = await perfilDoToken(cfg, token)
  if (!chamador) return res.status(401).json({ erro: 'Sessão inválida' })
  if (chamador.perfil !== 'Admin' || chamador.status !== 'Ativo') {
    return res.status(403).json({ erro: 'Somente administradores gerenciam usuários' })
  }

  const corpo = typeof req.body === 'object' && req.body !== null ? req.body : {}
  try {
    if (corpo.acao === 'criar') {
      const r = await criar(cfg, corpo)
      return res.status(r.status).json(r.corpo)
    }
    if (corpo.acao === 'redefinir') {
      const r = await redefinir(cfg, corpo, chamador)
      return res.status(r.status).json(r.corpo)
    }
    return res.status(400).json({ erro: 'Ação desconhecida (use "criar" ou "redefinir")' })
  } catch (erro) {
    console.error('[api/usuarios] erro inesperado:', erro)
    return res.status(500).json({ erro: 'Erro interno ao gerenciar o usuário' })
  }
}
