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

// Modo tela cheia global: recolhe a barra lateral e expande o conteúdo em
// qualquer página. Persiste para sobreviver a F5 e troca de rota.
const telaCheiaInicial = localStorage.getItem('ITSTOCK_TELA_CHEIA') === '1'

interface UiState {
  tema: Tema
  toasts: Toast[]
  sidebarAberta: boolean
  buscaAberta: boolean
  telaCheia: boolean
  alternarTema: () => void
  alternarSidebar: () => void
  alternarBusca: () => void
  fecharBusca: () => void
  alternarTelaCheia: () => void
  notificar: (tipo: TipoToast, mensagem: string) => void
  removerToast: (id: number) => void
}

let proximoId = 1

export const useUiStore = create<UiState>((set) => ({
  tema: temaInicial,
  toasts: [],
  sidebarAberta: false,
  buscaAberta: false,
  telaCheia: telaCheiaInicial,
  alternarTema: () =>
    set((state) => {
      const tema: Tema = state.tema === 'claro' ? 'escuro' : 'claro'
      aplicarTema(tema)
      return { tema }
    }),
  alternarSidebar: () =>
    set((state) => ({ sidebarAberta: !state.sidebarAberta })),
  alternarBusca: () => set((state) => ({ buscaAberta: !state.buscaAberta })),
  fecharBusca: () => set({ buscaAberta: false }),
  alternarTelaCheia: () =>
    set((state) => {
      const telaCheia = !state.telaCheia
      localStorage.setItem('ITSTOCK_TELA_CHEIA', telaCheia ? '1' : '0')
      return { telaCheia }
    }),
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
