import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  baixarDados: vi.fn(),
  sessaoAtual: vi.fn(),
}))

vi.mock('./client', () => ({ modoSupabase: true, cliente: vi.fn() }))
vi.mock('./bootstrap', () => ({ baixarDados: mocks.baixarDados }))
vi.mock('./auth', () => ({ sessaoAtual: mocks.sessaoAtual }))

async function carregar() {
  return await import('./foco')
}

/** Simula a aba voltando a ficar visível. */
function voltarParaAba() {
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  mocks.baixarDados.mockReset().mockResolvedValue(true)
  mocks.sessaoAtual.mockReset().mockResolvedValue({ email: 'a@b.com', trocarSenha: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('recarregarAoVoltar', () => {
  it('baixa os dados quando a aba volta a ficar visível', async () => {
    const { instalarRecargaAoFoco } = await carregar()
    const desligar = instalarRecargaAoFoco()

    voltarParaAba()
    await vi.waitFor(() => expect(mocks.baixarDados).toHaveBeenCalledTimes(1))
    desligar()
  })

  it('respeita o intervalo mínimo: 3 eventos em 1s viram 1 download', async () => {
    const { instalarRecargaAoFoco, INTERVALO_RECARREGA_MS } = await carregar()
    const desligar = instalarRecargaAoFoco()

    voltarParaAba()
    await vi.waitFor(() => expect(mocks.baixarDados).toHaveBeenCalledTimes(1))

    vi.advanceTimersByTime(2_000)
    voltarParaAba()
    window.dispatchEvent(new Event('focus'))
    voltarParaAba()
    await Promise.resolve()
    expect(mocks.baixarDados).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(INTERVALO_RECARREGA_MS)
    voltarParaAba()
    await vi.waitFor(() => expect(mocks.baixarDados).toHaveBeenCalledTimes(2))
    desligar()
  })

  it('não baixa nada sem sessão (anon não lê nenhuma tabela)', async () => {
    mocks.sessaoAtual.mockResolvedValue(null)
    const { instalarRecargaAoFoco } = await carregar()
    const desligar = instalarRecargaAoFoco()

    voltarParaAba()
    await vi.waitFor(() => expect(mocks.sessaoAtual).toHaveBeenCalled())
    expect(mocks.baixarDados).not.toHaveBeenCalled()
    desligar()
  })

  it('ignora o voltar da aba enquanto uma recarga anterior não termina', async () => {
    let resolver: (ok: boolean) => void = () => {}
    mocks.baixarDados.mockImplementationOnce(
      () => new Promise<boolean>((r) => (resolver = r)),
    )
    const { instalarRecargaAoFoco, INTERVALO_RECARREGA_MS } = await carregar()
    const desligar = instalarRecargaAoFoco()

    voltarParaAba()
    await vi.waitFor(() => expect(mocks.baixarDados).toHaveBeenCalledTimes(1))

    // segunda recarga saindo do intervalo mínimo, mas a primeira ainda roda
    vi.advanceTimersByTime(INTERVALO_RECARREGA_MS)
    voltarParaAba()
    await Promise.resolve()
    expect(mocks.baixarDados).toHaveBeenCalledTimes(1)

    // terminou a recarga anterior → o próximo voltar da aba é aceito
    resolver(true)
    await vi.advanceTimersByTimeAsync(0)
    voltarParaAba()
    await vi.waitFor(() => expect(mocks.baixarDados).toHaveBeenCalledTimes(2))
    desligar()
  })

  it('desligar remove os listeners', async () => {
    const { instalarRecargaAoFoco } = await carregar()
    instalarRecargaAoFoco()()

    voltarParaAba()
    window.dispatchEvent(new Event('focus'))
    await Promise.resolve()
    expect(mocks.baixarDados).not.toHaveBeenCalled()
  })
})

describe('modo local', () => {
  it('instalarRecargaAoFoco é no-op sem Supabase', async () => {
    vi.resetModules()
    vi.doMock('./client', () => ({ modoSupabase: false, cliente: vi.fn() }))
    const { instalarRecargaAoFoco } = await import('./foco')
    vi.doUnmock('./client')

    instalarRecargaAoFoco()()
    voltarParaAba()
    window.dispatchEvent(new Event('focus'))
    await Promise.resolve()
    expect(mocks.baixarDados).not.toHaveBeenCalled()
  })
})
