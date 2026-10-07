import { create } from 'zustand'
import { baixarDados } from '../data/bootstrap'
import {
  entrarComSenha as entrarNoSupabase,
  sairDoSupabase,
  sessaoAtual,
  trocarSenhaSupabase,
  type ResultadoAuth,
} from '../data/auth'
import { lerColecao } from '../data/repository'
import { registrarLog } from '../lib/audit'
import type { Usuario } from '../types'

const CHAVE_SESSAO = 'ITSTOCK_SESSAO'

function lerSessao(): Usuario | null {
  try {
    const raw = localStorage.getItem(CHAVE_SESSAO)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch {
    return null
  }
}

/** Perfil do usuário autenticado no Supabase (espelho vindo do banco). */
function perfilPor(email: string): Usuario | null {
  const alvo = email.trim().toLowerCase()
  return (
    lerColecao<Usuario>('USUARIOS').find(
      (u) => u.email.toLowerCase() === alvo && u.status === 'Ativo',
    ) ?? null
  )
}

function gravarSessao(usuario: Usuario): void {
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario))
}

interface AuthState {
  usuario: Usuario | null
  /** true = a senha atual é provisória e precisa ser trocada antes de usar. */
  trocarSenhaPendente: boolean
  entrar: (email: string) => boolean
  entrarComSenha: (email: string, senha: string) => Promise<ResultadoAuth>
  restaurarSessao: () => Promise<boolean>
  trocarSenha: (nova: string) => Promise<ResultadoAuth>
  sair: () => void
  atualizarSessao: (usuario: Usuario) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  usuario: lerSessao(),
  trocarSenhaPendente: false,

  entrar: (email) => {
    const usuario = lerColecao<Usuario>('USUARIOS').find(
      (u) => u.email === email && u.status === 'Ativo',
    )
    if (!usuario) return false
    gravarSessao(usuario)
    registrarLog({
      usuario: usuario.email,
      acao: 'LOGIN',
      tabela: 'SESSAO',
      registroId: usuario.email,
    })
    set({ usuario, trocarSenhaPendente: false })
    return true
  },

  entrarComSenha: async (email, senha) => {
    const resultado = await entrarNoSupabase(email, senha)
    if (!resultado.ok) return resultado

    // Com o RLS da Fase D o espelho só existe depois da autenticação — o boot
    // pula o download quando não há sessão. Aqui é o primeiro acesso.
    const carregado = await baixarDados()

    const perfil = perfilPor(email)
    if (!perfil) {
      await sairDoSupabase()
      return {
        ok: false,
        erro: carregado
          ? 'Usuário não encontrado ou inativo'
          : 'Não foi possível carregar os dados do servidor',
      }
    }

    gravarSessao(perfil)
    registrarLog({
      usuario: perfil.email,
      acao: 'LOGIN',
      tabela: 'SESSAO',
      registroId: perfil.email,
    })
    set({ usuario: perfil, trocarSenhaPendente: Boolean(resultado.trocarSenha) })
    return resultado
  },

  restaurarSessao: async () => {
    const sessao = await sessaoAtual()
    if (!sessao) return false

    let perfil = perfilPor(sessao.email)
    if (!perfil && lerColecao<Usuario>('USUARIOS').length === 0) {
      // espelho vazio: sem sessão no boot o download é pulado (RLS da Fase D),
      // então busca agora antes de decidir que a conta não existe.
      await baixarDados()
      perfil = perfilPor(sessao.email)
    }

    if (!perfil) {
      // conta existe no Auth mas não tem perfil ativo no app
      await sairDoSupabase()
      localStorage.removeItem(CHAVE_SESSAO)
      set({ usuario: null, trocarSenhaPendente: false })
      return false
    }

    gravarSessao(perfil)
    set({ usuario: perfil, trocarSenhaPendente: sessao.trocarSenha })
    return true
  },

  trocarSenha: async (nova) => {
    const resultado = await trocarSenhaSupabase(nova)
    if (!resultado.ok) return resultado

    set({ trocarSenhaPendente: false })
    const atual = get().usuario
    if (atual) {
      registrarLog({
        usuario: atual.email,
        acao: 'UPDATE',
        tabela: 'SESSAO',
        registroId: atual.email,
        mensagem: 'Senha alterada',
      })
    }
    return resultado
  },

  sair: () => {
    const atual = lerSessao()
    if (atual) {
      registrarLog({
        usuario: atual.email,
        acao: 'LOGOUT',
        tabela: 'SESSAO',
        registroId: atual.email,
      })
    }
    localStorage.removeItem(CHAVE_SESSAO)
    set({ usuario: null, trocarSenhaPendente: false })
    void sairDoSupabase()
  },

  atualizarSessao: (usuario) => {
    gravarSessao(usuario)
    set({ usuario })
  },
}))
