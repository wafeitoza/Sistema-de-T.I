import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sincronizarColecao: vi.fn(),
  proximaSequenciaRemota: vi.fn(),
}))

vi.mock('./client', () => ({ modoSupabase: true, cliente: vi.fn() }))
vi.mock('./api', () => ({
  NOMES_SEQUENCIA: ['SET', 'SOL'],
  TAMANHO_BLOCO: 50,
  proximaSequenciaRemota: mocks.proximaSequenciaRemota,
  sincronizarColecao: mocks.sincronizarColecao,
}))

async function carregar() {
  const repository = await import('./repository')
  const { useUiStore } = await import('../store/ui')
  // getState() devolve um snapshot: usar sempre o getter atual
  return { repository, ui: { get toasts() { return useUiStore.getState().toasts }, removerToast: (id: number) => useUiStore.getState().removerToast(id) } }
}

beforeEach(() => {
  vi.resetModules()
  mocks.sincronizarColecao.mockReset()
  mocks.proximaSequenciaRemota.mockReset()
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const chave = localStorage.key(i)
    if (chave?.startsWith('ITSTOCK_')) localStorage.removeItem(chave)
  }
})

describe('modo Supabase — espelho + sincronização', () => {
  it('escreve no localStorage na hora e só depois manda ao servidor', async () => {
    const { repository } = await carregar()
    mocks.sincronizarColecao.mockResolvedValue(undefined)

    repository.gravarColecao('ATIVOS', [{ codigo: 'NOTE-001' }])
    expect(repository.lerColecao('ATIVOS')).toEqual([{ codigo: 'NOTE-001' }])

    await vi.waitFor(() => expect(mocks.sincronizarColecao).toHaveBeenCalledTimes(1))
    expect(mocks.sincronizarColecao).toHaveBeenCalledWith('ATIVOS', [], [{ codigo: 'NOTE-001' }])
  })

  it('sincroniza apenas o que mudou (antes ≠ depois)', async () => {
    const { repository } = await carregar()
    mocks.sincronizarColecao.mockResolvedValue(undefined)

    repository.gravarColecao('SETORES', [{ id: '1', nome: 'TI' }])
    repository.gravarColecao('SETORES', [
      { id: '1', nome: 'TI' },
      { id: '2', nome: 'RH' },
    ])

    await vi.waitFor(() => expect(mocks.sincronizarColecao).toHaveBeenCalledTimes(2))
    expect(mocks.sincronizarColecao).toHaveBeenNthCalledWith(
      2,
      'SETORES',
      [{ id: '1', nome: 'TI' }],
      [
        { id: '1', nome: 'TI' },
        { id: '2', nome: 'RH' },
      ],
    )
  })

  it('avisa com toast quando a sincronização falha', async () => {
    const { repository, ui } = await carregar()
    mocks.sincronizarColecao.mockRejectedValue(new Error('rede fora'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    repository.gravarColecao('FORNECEDORES', [{ id: 'F1' }])
    await vi.waitFor(() => expect(ui.toasts.length).toBeGreaterThan(0))

    const toast = ui.toasts[ui.toasts.length - 1]
    expect(toast.tipo).toBe('erro')
    expect(toast.mensagem).toContain('FORNECEDORES')
    ui.removerToast(toast.id)
    consoleSpy.mockRestore()
  })

  it('gravarEspelho não toca na rede', async () => {
    const { repository } = await carregar()
    repository.gravarEspelho('AUDITORIA', [{ id: 'LOG-1' }])
    await new Promise((r) => setTimeout(r, 10))
    expect(repository.lerColecao('AUDITORIA')).toEqual([{ id: 'LOG-1' }])
    expect(mocks.sincronizarColecao).not.toHaveBeenCalled()
  })
})

describe('modo Supabase — sequências com bloco', () => {
  it('prepara os blocos com o topo vindo do servidor', async () => {
    const { repository } = await carregar()
    localStorage.setItem('ITSTOCK_SEQ_SET', '70')
    mocks.proximaSequenciaRemota.mockImplementation((nome, qtd) =>
      Promise.resolve(nome === 'SET' ? 120 : qtd),
    )

    await repository.prepararBlocos()

    expect(repository.limiteDeSequencia('SET')).toBe(120)
    expect(repository.limiteDeSequencia('SOL')).toBe(50)
    expect(repository.proximaSequencia('SET')).toBe(71)
    // SOL: servidor devolveu topo 50 com bloco de 50 → base 0 → próximo é 1
    expect(repository.proximaSequencia('SOL')).toBe(1)
  })

  it('usa o bloco inteiro e busca outro quando falta pouco (prefetch)', async () => {
    const { repository } = await carregar()
    localStorage.setItem('ITSTOCK_SEQ_SET', '70')
    mocks.proximaSequenciaRemota.mockImplementation((_nome, qtd) => Promise.resolve(70 + qtd))
    await repository.prepararBlocos()

    // limite 120, PREFETCH 25 → a 95ª chamada já dispara a próxima reserva
    for (let i = 0; i < 24; i++) expect(repository.proximaSequencia('SET')).toBe(71 + i)
    expect(mocks.proximaSequenciaRemota.mock.calls.filter((c) => c[0] === 'SET')).toHaveLength(1)

    expect(repository.proximaSequencia('SET')).toBe(95)
    await vi.waitFor(() => {
      const chamadas = mocks.proximaSequenciaRemota.mock.calls.filter((c) => c[0] === 'SET')
      expect(chamadas.length).toBeGreaterThan(1)
    })
    expect(repository.limiteDeSequencia('SET')).toBe(120)
  })

  it('nunca regride o valor local já usado', async () => {
    const { repository } = await carregar()
    localStorage.setItem('ITSTOCK_SEQ_SET', '300')
    mocks.proximaSequenciaRemota.mockResolvedValue(50)

    await repository.prepararBlocos()

    expect(repository.limiteDeSequencia('SET')).toBe(50)
    expect(localStorage.getItem('ITSTOCK_SEQ_SET')).toBe('300')
  })

  it('garantirBloco reserva a diferença quando um backup salta a contagem', async () => {
    const { repository } = await carregar()
    mocks.proximaSequenciaRemota.mockImplementation((_nome, qtd) => Promise.resolve(70 + qtd))
    await repository.prepararBlocos()
    expect(repository.limiteDeSequencia('SET')).toBe(120)

    repository.garantirBloco('SET', 600)

    await vi.waitFor(() => {
      const chamadas = mocks.proximaSequenciaRemota.mock.calls.filter((c) => c[0] === 'SET')
      expect(chamadas[chamadas.length - 1]).toEqual(['SET', 530])
    })
    await vi.waitFor(() => expect(repository.limiteDeSequencia('SET')).toBe(600))
  })

  it('carregarSequencia espelha o topo do servidor sem regredir', async () => {
    const { repository } = await carregar()
    repository.carregarSequencia('SET', 120)
    expect(localStorage.getItem('ITSTOCK_SEQ_SET')).toBe('120')

    repository.carregarSequencia('SET', 40)
    expect(localStorage.getItem('ITSTOCK_SEQ_SET')).toBe('120')
  })
})
