import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('@sentry/react', () => mocks)

const DSN = 'https://abc123@o123.ingest.sentry.io/456'

/** Importa o módulo zerado — `sdk` é estado do módulo e não pode vazar. */
async function modulo() {
  vi.resetModules()
  return await import('./erros')
}

afterEach(() => {
  vi.unstubAllEnvs()
  mocks.init.mockReset()
  mocks.captureException.mockReset()
})

describe('sem DSN — estado atual do sistema', () => {
  it('não inicializa nada e o boot segue normal', async () => {
    vi.unstubAllEnvs()
    const { iniciarErros, errosAtivos } = await modulo()

    await expect(iniciarErros()).resolves.toBeUndefined()

    expect(mocks.init).not.toHaveBeenCalled()
    expect(errosAtivos()).toBe(false)
  })

  it('DSN em branco conta como ausente', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')
    const { iniciarErros, errosAtivos } = await modulo()

    await iniciarErros()

    expect(mocks.init).not.toHaveBeenCalled()
    expect(errosAtivos()).toBe(false)
  })

  it('reportarErro é no-op e não lança', async () => {
    vi.unstubAllEnvs()
    const { iniciarErros, reportarErro } = await modulo()
    await iniciarErros()

    expect(() => reportarErro(new Error('qualquer'))).not.toThrow()
    expect(mocks.captureException).not.toHaveBeenCalled()
  })
})

describe('com DSN', () => {
  it('liga o SDK com as proteções de LGPD', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    const { iniciarErros, errosAtivos } = await modulo()

    await iniciarErros()

    expect(mocks.init).toHaveBeenCalledTimes(1)
    const opcoes = mocks.init.mock.calls[0][0] as Record<string, unknown>
    expect(opcoes.dsn).toBe(DSN)
    expect(opcoes.environment).toBe('producao')
    // sem rastreamento: nada de performance/URL indo junto por acidente
    expect(opcoes.tracesSampleRate).toBe(0)
    // a sanificação de LGPD precisa estar instalada de fato
    expect(opcoes.beforeSend).toBeTypeOf('function')
    expect(errosAtivos()).toBe(true)
  })

  it('beforeSend descarta request e user — nome/e-mail de servidor não vão para o Sentry', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    const { iniciarErros } = await modulo()
    await iniciarErros()

    const { beforeSend } = mocks.init.mock.calls[0][0] as {
      beforeSend: (e: Record<string, unknown>) => Record<string, unknown>
    }
    const evento = {
      message: 'falhou ao salvar ativo',
      request: { url: 'https://itstock.br/ativos', headers: { cookie: 'sessao=abc' } },
      user: { email: 'william@escola.br', name: 'William' },
    }

    const saida = beforeSend(evento)

    expect(saida.request).toBeUndefined()
    expect(saida.user).toBeUndefined()
    // o que importa para depurar continua lá
    expect(saida.message).toBe('falhou ao salvar ativo')
  })

  it('reportarErro passa o erro e o contexto para o SDK', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    const { iniciarErros, reportarErro } = await modulo()
    await iniciarErros()

    const erro = new Error('estouro de render')
    reportarErro(erro, { pagina: '/ativos' })

    expect(mocks.captureException).toHaveBeenCalledWith(erro, {
      extra: { pagina: '/ativos' },
    })
  })

  it('sem contexto manda só o erro', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    const { iniciarErros, reportarErro } = await modulo()
    await iniciarErros()

    reportarErro(new Error('sem contexto'))

    expect(mocks.captureException).toHaveBeenCalledWith(new Error('sem contexto'), undefined)
  })

  it('falha do SDK não derruba o boot', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.init.mockImplementationOnce(() => {
      throw new Error('DSN inválida')
    })
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    const { iniciarErros, errosAtivos } = await modulo()

    await expect(iniciarErros()).resolves.toBeUndefined()

    expect(errosAtivos()).toBe(false)
    expect(consoleErro).toHaveBeenCalled()
    consoleErro.mockRestore()
  })
})
