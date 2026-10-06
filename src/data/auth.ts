import { cliente, modoSupabase } from './client'

export interface ResultadoAuth {
  ok: boolean
  erro?: string
  /** Usuário logou com a senha provisória e precisa trocar antes de usar. */
  trocarSenha?: boolean
}

export interface SessaoAuth {
  email: string
  trocarSenha: boolean
}

const MENSAGENS: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos',
  user_not_found: 'E-mail ou senha incorretos',
  bad_password: 'E-mail ou senha incorretos',
  email_not_confirmed: 'Este e-mail ainda não foi confirmado',
  too_many_requests: 'Muitas tentativas. Aguarde alguns minutos e tente de novo',
  rate_limit_exceeded: 'Muitas tentativas. Aguarde alguns minutos e tente de novo',
  weak_password: 'A senha precisa ter pelo menos 8 caracteres',
  same_password: 'A nova senha precisa ser diferente da atual',
  user_already_exists: 'Já existe uma conta com este e-mail',
  over_email_send_rate_limit: 'Limite de e-mails atingido. Tente mais tarde',
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Erros do Supabase Auth traduzidos para o usuário. */
export function mensagemAuth(erro: unknown): string {
  const e = erro as { message?: string; code?: string; status?: number } | null
  if (!e) return 'Não foi possível entrar agora'
  const chave = (e.code || e.message || '').toLowerCase()
  const achada = Object.keys(MENSAGENS).find((k) => chave.includes(k))
  if (achada) return MENSAGENS[achada]
  if (e.status === 429) return MENSAGENS.too_many_requests
  return e.message || 'Não foi possível entrar agora'
}

function validarCredenciais(email: string, senha: string): string | null {
  if (!RE_EMAIL.test(email)) return 'Informe um e-mail válido'
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres'
  return null
}

/** Autentica por e-mail + senha no Supabase Auth. */
export async function entrarComSenha(email: string, senha: string): Promise<ResultadoAuth> {
  if (!modoSupabase) return { ok: false, erro: 'Login por senha exige o Supabase' }
  const problema = validarCredenciais(email, senha)
  if (problema) return { ok: false, erro: problema }

  try {
    const { data, error } = await cliente().auth.signInWithPassword({ email, password: senha })
    if (error) return { ok: false, erro: mensagemAuth(error) }
    return {
      ok: true,
      trocarSenha: Boolean(data.user?.user_metadata?.trocar_senha),
    }
  } catch (erro) {
    return { ok: false, erro: mensagemAuth(erro) }
  }
}

/** Sessão Supabase vigente (ou null). Usada no boot para restaurar o acesso. */
export async function sessaoAtual(): Promise<SessaoAuth | null> {
  if (!modoSupabase) return null
  try {
    const { data } = await cliente().auth.getSession()
    const user = data.session?.user
    if (!user?.email) return null
    return { email: user.email, trocarSenha: Boolean(user.user_metadata?.trocar_senha) }
  } catch {
    return null
  }
}

/** Troca a senha e desliga a marca de "senha provisória". */
export async function trocarSenhaSupabase(nova: string): Promise<ResultadoAuth> {
  if (!modoSupabase) return { ok: false, erro: 'Troca de senha exige o Supabase' }
  if (nova.length < 8) return { ok: false, erro: 'A senha precisa ter pelo menos 8 caracteres' }

  try {
    const { error } = await cliente().auth.updateUser({ password: nova })
    if (error) return { ok: false, erro: mensagemAuth(error) }
    const { error: erroMeta } = await cliente().auth.updateUser({
      data: { trocar_senha: false },
    })
    if (erroMeta) console.warn('[supabase] não marcou a troca de senha:', erroMeta.message)
    return { ok: true }
  } catch (erro) {
    return { ok: false, erro: mensagemAuth(erro) }
  }
}

/** Encerra a sessão no Supabase (mantém o comportamento do logout local). */
export async function sairDoSupabase(): Promise<void> {
  if (!modoSupabase) return
  try {
    await cliente().auth.signOut()
  } catch (erro) {
    console.warn('[supabase] logout incompleto:', erro)
  }
}

/** Token de acesso da sessão (a Vercel Function usa para validar o Admin). */
export async function tokenAtual(): Promise<string | null> {
  if (!modoSupabase) return null
  try {
    const { data } = await cliente().auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}
