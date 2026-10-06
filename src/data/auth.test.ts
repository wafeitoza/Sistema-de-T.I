import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({
  modo: true,
  auth: {
    signInWithPassword: vi.fn(),
    getSession: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
}))

vi.mock('./client', () => ({
  get modoSupabase() {
    return estado.modo
  },
  cliente: () => ({ auth: estado.auth }),
}))

const auth = await import('./auth')

function sessao(email: string, trocarSenha = false) {
  return { data: { session: { user: { email, user_metadata: { trocar_senha: trocarSenha } } } } }
}

beforeEach(() => {
  estado.modo = true
  estado.auth.signInWithPassword.mockReset()
  estado.auth.getSession.mockReset()
  estado.auth.updateUser.mockReset()
  estado.auth.signOut.mockReset()
  vi.restoreAllMocks()
})

describe('entrarComSenha', () => {
  it('valida e-mail e senha antes de chamar o Supabase', async () => {
    expect(await auth.entrarComSenha('sem-arroba', '12345678')).toEqual({
      ok: false,
      erro: 'Informe um e-mail válido',
    })
    expect(await auth.entrarComSenha('a@b.com', '123')).toEqual({
      ok: false,
      erro: 'A senha precisa ter pelo menos 8 caracteres',
    })
    expect(estado.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('traduz credenciais inválidas', async () => {
    estado.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    })

    expect(await auth.entrarComSenha('a@b.com', '12345678')).toEqual({
      ok: false,
      erro: 'E-mail ou senha incorretos',
    })
  })

  it('devolve trocarSenha=true quando a conta está com senha provisória', async () => {
    estado.auth.signInWithPassword.mockResolvedValue({
      data: { user: { user_metadata: { trocar_senha: true } } },
      error: null,
    })

    expect(await auth.entrarComSenha('a@b.com', '12345678')).toEqual({
      ok: true,
      trocarSenha: true,
    })
    expect(estado.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: '12345678',
    })
  })

  it('devolve trocarSenha=false quando a senha já é definitiva', async () => {
    estado.auth.signInWithPassword.mockResolvedValue({
      data: { user: { user_metadata: {} } },
      error: null,
    })

    expect(await auth.entrarComSenha('a@b.com', '12345678')).toEqual({
      ok: true,
      trocarSenha: false,
    })
  })

  it('converte exceção de rede em erro amigável', async () => {
    estado.auth.signInWithPassword.mockRejectedValue(new Error('rede caiu'))

    expect(await auth.entrarComSenha('a@b.com', '12345678')).toEqual({
      ok: false,
      erro: 'rede caiu',
    })
  })
})

describe('sessaoAtual', () => {
  it('devolve null quando não há sessão', async () => {
    estado.auth.getSession.mockResolvedValue({ data: { session: null } })
    expect(await auth.sessaoAtual()).toBeNull()
  })

  it('devolve e-mail e marca de troca de senha', async () => {
    estado.auth.getSession.mockResolvedValue(sessao('a@b.com', true))
    expect(await auth.sessaoAtual()).toEqual({ email: 'a@b.com', trocarSenha: true })
  })

  it('devolve null quando a sessão não tem e-mail', async () => {
    estado.auth.getSession.mockResolvedValue({ data: { session: { user: {} } } })
    expect(await auth.sessaoAtual()).toBeNull()
  })

  it('não deixa exceção escapar (boot não pode quebrar)', async () => {
    estado.auth.getSession.mockRejectedValue(new Error('boom'))
    expect(await auth.sessaoAtual()).toBeNull()
  })
})

describe('trocarSenhaSupabase', () => {
  it('recusa senha curta sem chamar o servidor', async () => {
    expect(await auth.trocarSenhaSupabase('123')).toEqual({
      ok: false,
      erro: 'A senha precisa ter pelo menos 8 caracteres',
    })
    expect(estado.auth.updateUser).not.toHaveBeenCalled()
  })

  it('atualiza a senha e desliga a marca de provisória', async () => {
    estado.auth.updateUser
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })

    expect(await auth.trocarSenhaSupabase('senha-nova-1')).toEqual({ ok: true })
    expect(estado.auth.updateUser).toHaveBeenNthCalledWith(1, { password: 'senha-nova-1' })
    expect(estado.auth.updateUser).toHaveBeenNthCalledWith(2, { data: { trocar_senha: false } })
  })

  it('mesmo se a marca falhar, a senha já foi trocada', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    estado.auth.updateUser
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'meta falhou' } })

    expect(await auth.trocarSenhaSupabase('senha-nova-1')).toEqual({ ok: true })
    expect(console.warn).toHaveBeenCalled()
  })

  it('propaga o erro quando a troca de senha falha', async () => {
    estado.auth.updateUser.mockResolvedValue({
      error: { message: 'New password should be different', code: 'same_password' },
    })

    expect(await auth.trocarSenhaSupabase('senha-nova-1')).toEqual({
      ok: false,
      erro: 'A nova senha precisa ser diferente da atual',
    })
  })
})

describe('sairDoSupabase', () => {
  it('encerra a sessão no servidor', async () => {
    estado.auth.signOut.mockResolvedValue({ error: null })
    await auth.sairDoSupabase()
    expect(estado.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('só avisa quando o logout falha (o logout local já aconteceu)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    estado.auth.signOut.mockRejectedValue(new Error('offline'))

    await expect(auth.sairDoSupabase()).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('tokenAtual', () => {
  it('devolve o access token da sessão', async () => {
    estado.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-abc' } },
    })
    expect(await auth.tokenAtual()).toBe('jwt-abc')
  })

  it('devolve null sem sessão', async () => {
    estado.auth.getSession.mockResolvedValue({ data: { session: null } })
    expect(await auth.tokenAtual()).toBeNull()
  })
})

describe('mensagemAuth', () => {
  it('usa mensagem genérica quando não há erro', () => {
    expect(auth.mensagemAuth(null)).toBe('Não foi possível entrar agora')
  })

  it('traduz limite de tentativas pelo status 429', () => {
    expect(auth.mensagemAuth({ message: 'espera', status: 429 })).toBe(
      'Muitas tentativas. Aguarde alguns minutos e tente de novo',
    )
  })

  it('cai na mensagem original quando é desconhecida', () => {
    expect(auth.mensagemAuth({ message: 'algo inesperado' })).toBe('algo inesperado')
  })
})

describe('modo local', () => {
  it('nenhuma função de auth passa do navegador sem Supabase', async () => {
    estado.modo = false

    expect(await auth.entrarComSenha('a@b.com', '12345678')).toEqual({
      ok: false,
      erro: 'Login por senha exige o Supabase',
    })
    expect(await auth.sessaoAtual()).toBeNull()
    expect(await auth.trocarSenhaSupabase('senha-nova-1')).toEqual({
      ok: false,
      erro: 'Troca de senha exige o Supabase',
    })
    expect(await auth.tokenAtual()).toBeNull()

    await auth.sairDoSupabase()
    expect(estado.auth.signOut).not.toHaveBeenCalled()
  })
})
