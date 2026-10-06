import { tokenAtual } from './auth'
import { modoSupabase } from './client'

export interface DadosConta {
  nome: string
  email: string
  perfil: string
  setor: string
}

interface ResultadoConta {
  ok: boolean
  erro?: string
  /** Senha provisória — mostrada uma única vez e depois trocada pelo usuário. */
  senhaProvisoria?: string
}

/**
 * Contas de acesso só são criadas/redefinidas pela Vercel Function
 * (`api/usuarios.mjs`), porque a chave service_role fica no servidor.
 * O navegador manda o próprio access token; a função confere se quem chamou
 * é Admin antes de tocar no Supabase Auth.
 */
async function chamarApi(corpo: Record<string, unknown>): Promise<ResultadoConta> {
  if (!modoSupabase) return { ok: false, erro: 'Gerência de contas exige o Supabase' }

  const token = await tokenAtual()
  if (!token) return { ok: false, erro: 'Sessão expirada. Entre novamente' }

  try {
    const resposta = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
    })
    const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null
    if (!resposta.ok) {
      return { ok: false, erro: dados?.erro ?? 'Não foi possível concluir a operação' }
    }
    return { ok: true, senhaProvisoria: (dados as { senhaProvisoria?: string })?.senhaProvisoria }
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor de contas' }
  }
}

/** Cria a conta no Supabase Auth e devolve a senha provisória. */
export function criarConta(dados: DadosConta): Promise<ResultadoConta> {
  return chamarApi({ acao: 'criar', ...dados })
}

/** Gera uma nova senha provisória para uma conta existente. */
export function redefinirConta(email: string): Promise<ResultadoConta> {
  return chamarApi({ acao: 'redefinir', email })
}
