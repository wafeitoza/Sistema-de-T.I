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
 *   { acao: 'excluir',   email }                      → { email, contaApagada }
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
  const perfil = Array.isArray(linhas) ? linhas[0] ?? null : null
  if (!perfil) return null
  // Senha provisória: a tela já abre um modal que não fecha, mas a tela é só
  // o navegador de quem está logado — não impede nada. Marcar aqui é o que
  // deixa a regra valer também para quem chama a API por fora.
  return { ...perfil, trocarSenha: Boolean(user.user_metadata?.trocar_senha) }
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

/**
 * Apaga a conta de acesso (Supabase Auth) e o cadastro em `usuarios`.
 *
 * A ordem é Auth → cadastro de propósito: se algo falhar no meio, o pior caso
 * possível é o cadastro órfão — que não concede login — e nunca uma conta viva
 * sem perfil. E não há rollback (não se recria conta apagada), por isso a
 * falha no cadastro é reportada com o e-mail no log do servidor.
 */
async function excluir(cfg, corpo, chamador) {
  const email = String(corpo.email ?? '').trim().toLowerCase()
  if (!RE_EMAIL.test(email)) return { status: 400, corpo: { erro: 'E-mail inválido' } }

  // A autoexclusão trava aqui, não só no botão da UI: um Admin que se apaga
  // deixa o sistema sem ninguém para gerenciar usuários.
  if (email === chamador.email) {
    return { status: 400, corpo: { erro: 'Você não pode excluir a própria conta' } }
  }

  const consulta = await fetch(
    `${cfg.url}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=auth_id`,
    { headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` } },
  )
  const linhas = await lerJson(consulta)
  if (!Array.isArray(linhas) || linhas.length === 0) {
    return { status: 404, corpo: { erro: 'Usuário não encontrado' } }
  }
  const authId = linhas[0]?.auth_id ?? null

  let contaApagada = false
  if (authId) {
    const auth = await fetch(`${cfg.url}/auth/v1/admin/users/${authId}`, {
      method: 'DELETE',
      headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` },
    })
    // 404 significa "já não existe" — e é o que torna a exclusão repetível
    // depois de uma falha parcial no cadastro.
    if (!auth.ok && auth.status !== 404) {
      console.error('[api/usuarios] deleteUser:', auth.status, await lerJson(auth))
      return { status: 502, corpo: { erro: 'Não foi possível apagar a conta de acesso' } }
    }
    contaApagada = true
  }

  const cadastro = await fetch(
    `${cfg.url}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`,
    { method: 'DELETE', headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}` } },
  )
  if (!cadastro.ok) {
    console.error('[api/usuarios] delete cadastro:', cadastro.status, email, await lerJson(cadastro))
    return {
      status: 502,
      corpo: {
        erro: 'A conta de acesso foi apagada, mas o cadastro não. Tente novamente',
        email,
      },
    }
  }

  return { status: 200, corpo: { email, contaApagada } }
}

/**
 * Registra a ação no log de auditoria.
 *
 * Por que isto existe: criar/redefinir/excluir são chamados numa Function que
 * qualquer portador de token de Admin válido alcança direto, sem passar pela
 * tela. Enquanto a gravação era só do navegador, esse caminho não deixava
 * rastro nenhum — confirmado por teste em produção (15/10/2026): criar e
 * apagar conta pela API devolveu 200 e a tabela `auditoria` ficou igual.
 *
 * Duas coisas de propósito aqui:
 *  - a senha provisória NUNCA entra nos campos auditados;
 *  - a falha de auditoria é reportada no log do servidor mas não derruba a
 *    operação — derrubar a gestão de contas por causa do log seria pior. O
 *    RLS da `auditoria` (append-only, sem UPDATE/DELETE) impede que quem
 *    chame a API apague a própria trilha depois.
 */
async function auditar(cfg, entrada) {
  try {
    // mesmo formato de id que o cliente usa ('LOG-AAAA-NNNNNN'), na mesma
    // sequência — os dois fluxos continuam numerados numa linha só
    const seq = await fetch(`${cfg.url}/rest/v1/rpc/proxima_sequencia`, {
      method: 'POST',
      headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_nome: 'LOG' }),
    })
    const numero = seq.ok ? await lerJson(seq) : null

    const resposta = await fetch(`${cfg.url}/rest/v1/auditoria`, {
      method: 'POST',
      headers: {
        apikey: cfg.service,
        Authorization: `Bearer ${cfg.service}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        id: `LOG-${new Date().getFullYear()}-${String(numero ?? Date.now()).padStart(6, '0')}`,
        usuario: entrada.usuario,
        acao: entrada.acao,
        tabela: 'USUARIOS',
        registro_id: entrada.registroId,
        campos: entrada.campos ?? [],
        resultado: entrada.resultado,
        mensagem: entrada.mensagem ?? null,
      }),
    })
    if (!resposta.ok) {
      console.error('[api/usuarios] auditoria:', resposta.status, await lerJson(resposta))
    }
  } catch (erro) {
    console.error('[api/usuarios] auditoria:', erro)
  }
}

/** Ação da API → ação do vocabulário da `auditoria` (constraint da tabela). */
const ACAO_LOG = { criar: 'CREATE', redefinir: 'RESET', excluir: 'DELETE' }

/** Mensagem lida na tela de auditoria — mesmo tom das linhas gravadas pelo cliente. */
const MENSAGEM_OK = {
  criar: 'Conta criada pela API',
  redefinir: 'Senha redefinida pela API',
  excluir: 'Conta excluída pela API',
}

/**
 * Resumo do que foi feito, sem segredo.
 * A senha provisória é gerada e devolvida na resposta, mas fica de fora daqui
 * de propósito: o log é legível por quem lê auditoria e não é um lugar para
 * credencial, mesmo provisória.
 */
function resumoCampos(acao, corpo, resultado) {
  if (acao === 'criar') {
    return [
      { campo: 'email', antes: null, depois: resultado.email ?? null },
      { campo: 'nome', antes: null, depois: String(corpo.nome ?? '') },
      { campo: 'perfil', antes: null, depois: String(corpo.perfil ?? '') },
      { campo: 'setor', antes: null, depois: String(corpo.setor ?? '') },
    ]
  }
  if (acao === 'redefinir') {
    return [
      { campo: 'senha', antes: null, depois: 'provisória regenerada' },
      { campo: 'trocar_senha', antes: null, depois: true },
    ]
  }
  return [
    { campo: 'conta_apagada', antes: null, depois: resultado.contaApagada ?? null },
  ]
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

  const corpo = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const acao = String(corpo.acao ?? '')
  const alvo = String(corpo.email ?? '').trim().toLowerCase() || '—'

  // Tentativa negada é o sinal mais interessante do log: alguém com conta
  // válida tentou gerenciar usuários sem ter o direito.
  if (chamador.perfil !== 'Admin' || chamador.status !== 'Ativo') {
    await auditar(cfg, {
      usuario: chamador.email,
      acao: ACAO_LOG[acao] ?? 'UPDATE',
      registroId: alvo,
      resultado: 'Erro',
      mensagem: `acesso negado — perfil ${chamador.perfil}, status ${chamador.status}`,
    })
    return res.status(403).json({ erro: 'Somente administradores gerenciam usuários' })
  }

  // Senha provisória ainda em uso: a mesma trava da tela, agora no servidor.
  // Sem isto, um Admin recém-criado conseguia continuar gerenciando contas
  // por curl sem nunca trocar a senha que recebeu — medido em produção
  // (15/10/2026): a API devolvia 200 com `trocar_senha: true`.
  if (chamador.trocarSenha) {
    await auditar(cfg, {
      usuario: chamador.email,
      acao: ACAO_LOG[acao] ?? 'UPDATE',
      registroId: alvo,
      resultado: 'Erro',
      mensagem: 'senha provisória ainda não trocada — gestão recusada',
    })
    return res.status(403).json({
      erro: 'Sua senha ainda é a provisória. Troque-a antes de gerenciar usuários.',
    })
  }

  if (!ACAO_LOG[acao]) {
    return res
      .status(400)
      .json({ erro: 'Ação desconhecida (use "criar", "redefinir" ou "excluir")' })
  }

  try {
    const r =
      acao === 'criar'
        ? await criar(cfg, corpo)
        : acao === 'redefinir'
          ? await redefinir(cfg, corpo, chamador)
          : await excluir(cfg, corpo, chamador)

    await auditar(cfg, {
      usuario: chamador.email,
      acao: ACAO_LOG[acao],
      registroId: alvo,
      resultado: r.status < 400 ? 'Sucesso' : 'Erro',
      mensagem: r.status < 400 ? MENSAGEM_OK[acao] : (r.corpo?.erro ?? `HTTP ${r.status}`),
      campos: r.status < 400 ? resumoCampos(acao, corpo, r.corpo) : [],
    })

    return res.status(r.status).json(r.corpo)
  } catch (erro) {
    console.error('[api/usuarios] erro inesperado:', erro)
    await auditar(cfg, {
      usuario: chamador.email,
      acao: ACAO_LOG[acao],
      registroId: alvo,
      resultado: 'Erro',
      mensagem: 'exceção não tratada na API',
    })
    return res.status(500).json({ erro: 'Erro interno ao gerenciar o usuário' })
  }
}
