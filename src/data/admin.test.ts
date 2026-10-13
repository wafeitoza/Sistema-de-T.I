import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({ modo: true, token: 'jwt-abc' as string | null }))

vi.mock('./client', () => ({
  get modoSupabase() {
    return estado.modo
  },
  cliente: vi.fn(),
}))
vi.mock('./auth', () => ({ tokenAtual: vi.fn(async () => estado.token) }))

const { apagarConta, criarConta, redefinirConta } = await import('./admin')
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function resposta(status: number, corpo: unknown) {
  return { ok: status < 400, status, json: async () => corpo }
}

const DADOS = { nome: 'Ana Lima', email: 'ana@empresa.com', perfil: 'Técnico', setor: 'TI' }

beforeEach(() => {
  estado.modo = true
  estado.token = 'jwt-abc'
  fetchMock.mockReset()
})

describe('criarConta', () => {
  it('manda a sessão e o payload para a Vercel Function', async () => {
    fetchMock.mockResolvedValue(resposta(200, { email: DADOS.email, senhaProvisoria: 'Itstock-AB1234cd' }))

    const r = await criarConta(DADOS)

    expect(r).toEqual({ ok: true, senhaProvisoria: 'Itstock-AB1234cd' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/usuarios')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer jwt-abc')
    expect(JSON.parse(init.body)).toEqual({ acao: 'criar', ...DADOS })
  })

  it('repassa o erro do servidor (403 de não-admin)', async () => {
    fetchMock.mockResolvedValue(
      resposta(403, { erro: 'Somente administradores gerenciam usuários' }),
    )

    expect(await criarConta(DADOS)).toEqual({
      ok: false,
      erro: 'Somente administradores gerenciam usuários',
    })
  })

  it('usa mensagem de reserva quando a resposta não é JSON', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => null })

    expect(await criarConta(DADOS)).toEqual({
      ok: false,
      erro: 'Não foi possível concluir a operação',
    })
  })

  it('diz quando o servidor está fora do ar', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    expect(await criarConta(DADOS)).toEqual({
      ok: false,
      erro: 'Sem conexão com o servidor de contas',
    })
  })
})

describe('redefinirConta', () => {
  it('pede a nova senha provisória para o e-mail informado', async () => {
    fetchMock.mockResolvedValue(resposta(200, { senhaProvisoria: 'Itstock-ZZ9876ef' }))

    expect(await redefinirConta('ana@empresa.com')).toEqual({
      ok: true,
      senhaProvisoria: 'Itstock-ZZ9876ef',
    })
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ acao: 'redefinir', email: 'ana@empresa.com' })
  })

  it('repassa o 404 de conta inexistente', async () => {
    fetchMock.mockResolvedValue(resposta(404, { erro: 'Usuário ainda não tem conta de acesso' }))

    expect(await redefinirConta('ana@empresa.com')).toEqual({
      ok: false,
      erro: 'Usuário ainda não tem conta de acesso',
    })
  })
})

describe('apagarConta', () => {
  it('manda a exclusão para a Vercel Function', async () => {
    fetchMock.mockResolvedValue(resposta(200, { email: 'ana@empresa.com', contaApagada: true }))

    expect(await apagarConta('ana@empresa.com')).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/usuarios')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer jwt-abc')
    expect(JSON.parse(init.body)).toEqual({ acao: 'excluir', email: 'ana@empresa.com' })
  })

  it('repassa o 400 de autoexclusão (o servidor recusa, não só a UI)', async () => {
    fetchMock.mockResolvedValue(
      resposta(400, { erro: 'Você não pode excluir a própria conta' }),
    )

    expect(await apagarConta('admin@empresa.com')).toEqual({
      ok: false,
      erro: 'Você não pode excluir a própria conta',
    })
  })

  it('repassa o 404 de usuário inexistente', async () => {
    fetchMock.mockResolvedValue(resposta(404, { erro: 'Usuário não encontrado' }))

    expect(await apagarConta('nao-existe@empresa.com')).toEqual({
      ok: false,
      erro: 'Usuário não encontrado',
    })
  })

  it('repassa a falha parcial: conta apagada mas cadastro não', async () => {
    fetchMock.mockResolvedValue(
      resposta(502, {
        erro: 'A conta de acesso foi apagada, mas o cadastro não. Tente novamente',
        email: 'ana@empresa.com',
      }),
    )

    expect(await apagarConta('ana@empresa.com')).toEqual({
      ok: false,
      erro: 'A conta de acesso foi apagada, mas o cadastro não. Tente novamente',
    })
  })
})

describe('modo local', () => {
  it('não existe gestão de contas sem Supabase', async () => {
    estado.modo = false

    expect(await criarConta(DADOS)).toEqual({
      ok: false,
      erro: 'Gerência de contas exige o Supabase',
    })
    expect(await redefinirConta('ana@empresa.com')).toEqual({
      ok: false,
      erro: 'Gerência de contas exige o Supabase',
    })
    expect(await apagarConta('ana@empresa.com')).toEqual({
      ok: false,
      erro: 'Gerência de contas exige o Supabase',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exige sessão válida antes de chamar a API', async () => {
    estado.token = null

    expect(await criarConta(DADOS)).toEqual({
      ok: false,
      erro: 'Sessão expirada. Entre novamente',
    })
    expect(await apagarConta('ana@empresa.com')).toEqual({
      ok: false,
      erro: 'Sessão expirada. Entre novamente',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
