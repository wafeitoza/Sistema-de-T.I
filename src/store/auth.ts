import { create } from 'zustand'
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

interface AuthState {
  usuario: Usuario | null
  entrar: (email: string) => boolean
  sair: () => void
  atualizarSessao: (usuario: Usuario) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: lerSessao(),
  entrar: (email) => {
    const usuario = lerColecao<Usuario>('USUARIOS').find(
      (u) => u.email === email && u.status === 'Ativo',
    )
    if (!usuario) return false
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario))
    registrarLog({
      usuario: usuario.email,
      acao: 'LOGIN',
      tabela: 'SESSAO',
      registroId: usuario.email,
    })
    set({ usuario })
    return true
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
    set({ usuario: null })
  },
  atualizarSessao: (usuario) => {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario))
    set({ usuario })
  },
}))
