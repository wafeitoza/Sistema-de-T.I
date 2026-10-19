import { beforeEach, describe, expect, it, vi } from 'vitest'

// Reimporta o módulo para que o estado inicial (lido do localStorage no
// carregamento do módulo) seja recalculado a cada teste.
async function carregarStore() {
  vi.resetModules()
  return await import('./ui')
}

beforeEach(() => {
  localStorage.clear()
})

describe('useUiStore — tema', () => {
  it('parte com o tema salvo e alterna persistindo', async () => {
    localStorage.setItem('ITSTOCK_TEMA', 'escuro')
    const { useUiStore } = await carregarStore()
    expect(useUiStore.getState().tema).toBe('escuro')

    useUiStore.getState().alternarTema()
    expect(useUiStore.getState().tema).toBe('claro')
    expect(localStorage.getItem('ITSTOCK_TEMA')).toBe('claro')
  })
})

describe('useUiStore — tela cheia', () => {
  it('parte desligada quando nada foi salvo', async () => {
    const { useUiStore } = await carregarStore()
    expect(useUiStore.getState().telaCheia).toBe(false)
  })

  it('restaura a preferência salva', async () => {
    localStorage.setItem('ITSTOCK_TELA_CHEIA', '1')
    const { useUiStore } = await carregarStore()
    expect(useUiStore.getState().telaCheia).toBe(true)
  })

  it('alterna e persiste em ambas as direções', async () => {
    const { useUiStore } = await carregarStore()

    useUiStore.getState().alternarTelaCheia()
    expect(useUiStore.getState().telaCheia).toBe(true)
    expect(localStorage.getItem('ITSTOCK_TELA_CHEIA')).toBe('1')

    useUiStore.getState().alternarTelaCheia()
    expect(useUiStore.getState().telaCheia).toBe(false)
    expect(localStorage.getItem('ITSTOCK_TELA_CHEIA')).toBe('0')
  })
})
