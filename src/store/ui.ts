import { create } from 'zustand'

export type TipoToast = 'sucesso' | 'erro' | 'info'

export interface Toast {
  id: number
  tipo: TipoToast
  mensagem: string
}

type Tema = 'claro' | 'escuro'

function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle('dark', tema === 'escuro')
  localStorage.setItem('ITSTOCK_TEMA', tema)
}

const temaInicial: Tema =
  (localStorage.getItem('ITSTOCK_TEMA') as Tema | null) ?? 'claro'

interface UiState {
  tema: Tema
  toasts: Toast[]
  sidebarAberta: boolean
  alternarTema: () => void
  alternarSidebar: () => void
  notificar: (tipo: TipoToast, mensagem: string) => void
  removerToast: (id: number) => void
}

let proximoId = 1

export const useUiStore = create<UiState>((set) => ({
  tema: temaInicial,
  toasts: [],
  sidebarAberta: false,
  alternarTema: () =>
    set((state) => {
      const tema: Tema = state.tema === 'claro' ? 'escuro' : 'claro'
      aplicarTema(tema)
      return { tema }
    }),
  alternarSidebar: () =>
    set((state) => ({ sidebarAberta: !state.sidebarAberta })),
  notificar: (tipo, mensagem) => {
    const id = proximoId++
    set((state) => ({ toasts: [...state.toasts, { id, tipo, mensagem }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removerToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

aplicarTema(temaInicial)
