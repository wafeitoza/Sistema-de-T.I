import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Usuario } from '../types'

const authMock = vi.hoisted(() => ({
  entrarComSenha: vi.fn(),
  sairDoSupabase: vi.fn(async () => {}),
  sessaoAtual: vi.fn(),
  trocarSenhaSupabase: vi.fn(),
  tokenAtual: vi.fn(async () => null),
}))

vi.mock('../data/auth', () => authMock)

const ADMIN: Usuario = {
  email: 'admin@empresa.com',
  nome: 'Alice Admin',
  perfil: 'Admin',
  setor: 'TI',
  status: 'Ativo',
}
const INATIVO: Usuario = {
  email: 'off@empresa.com',
  nome: 'Fulano',
  perfil: 'Visualizador',
  setor: 'RH',
  status: 'Inativo',
}

const { useAuthStore } = await import('./auth')
const { lerColecao } = await import('../data/repository')

function sessaoSupabase(email: string, trocarSenha = false) {
  return { email, trocarSenha }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('ITSTOCK_USUARIOS', JSON.stringify([ADMIN, INATIVO]))
  useAuthStore.setState({ usuario: null, trocarSenhaPendente: false })
})

describe('entrar (modo local, por card)', () => {
  it('cria sessão e registra LOGIN na auditoria', () => {
    expect(useAuthStore.getState().entrar(ADMIN.email)).toBe(true)

    const { usuario } = useAuthStore.getState()
    expect(usuario?.email).toBe(ADMIN.email)
    expect(JSON.parse(localStorage.getItem('ITSTOCK_SESSAO') ?? 'null').email).toBe(ADMIN.email)
    expect(lerColecao('LOG')).toHaveLength(1)
    expect(lerColecao<{ acao: string; registroId: string }>('LOG')[0]).toMatchObject({
      acao: 'LOGIN',
      registroId: ADMIN.email,
    })
  })

  it('recusa e-mail sem conta ou inativo', () => {
    expect(useAuthStore.getState().entrar('ninguem@empresa.com')).toBe(false)
    expect(useAuthStore.getState().entrar(INATIVO.email)).toBe(false)
    expect(useAuthStore.getState().usuario).toBeNull()
    expect(localStorage.getItem('ITSTOCK_SESSAO')).toBeNull()
  })
})

describe('entrarComSenha', () => {
  it('autentica, grava a sessão e propaga a troca pendente', async () => {
    authMock.entrarComSenha.mockResolvedValue({ ok: true, trocarSenha: true })

    const r = await useAuthStore.getState().entrarComSenha(ADMIN.email, 'senha-provisoria')

    expect(r).toEqual({ ok: true, trocarSenha: true })
    const estado = useAuthStore.getState()
    expect(estado.usuario?.nome).toBe('Alice Admin')
    expect(estado.trocarSenhaPendente).toBe(true)
    expect(localStorage.getItem('ITSTOCK_SESSAO')).not.toBeNull()
    expect(lerColecao<{ acao: string }>('LOG')[0].acao).toBe('LOGIN')
  })

  it('sai do Supabase quando a conta não tem perfil ativo no app', async () => {
    authMock.entrarComSenha.mockResolvedValue({ ok: true })

    const r = await useAuthStore.getState().entrarComSenha(INATIVO.email, 'senha')

    expect(r).toEqual({ ok: false, erro: 'Usuário não encontrado ou inativo' })
    expect(authMock.sairDoSupabase).toHaveBeenCalled()
    expect(useAuthStore.getState().usuario).toBeNull()
    expect(localStorage.getItem('ITSTOCK_SESSAO')).toBeNull()
  })

  it('mantém a tela de login quando as credenciais falham', async () => {
    authMock.entrarComSenha.mockResolvedValue({ ok: false, erro: 'E-mail ou senha incorretos' })

    const r = await useAuthStore.getState().entrarComSenha(ADMIN.email, 'errada')

    expect(r).toEqual({ ok: false, erro: 'E-mail ou senha incorretos' })
    expect(useAuthStore.getState().usuario).toBeNull()
    expect(lerColecao('LOG')).toHaveLength(0)
  })
})

describe('restaurarSessao', () => {
  it('devolve false e não loga quando não há sessão Supabase', async () => {
    authMock.sessaoAtual.mockResolvedValue(null)

    expect(await useAuthStore.getState().restaurarSessao()).toBe(false)
    expect(useAuthStore.getState().usuario).toBeNull()
  })

  it('desloga quando a conta existe no Auth mas o perfil está inativo', async () => {
    authMock.sessaoAtual.mockResolvedValue(sessaoSupabase(INATIVO.email))

    expect(await useAuthStore.getState().restaurarSessao()).toBe(false)
    expect(authMock.sairDoSupabase).toHaveBeenCalled()
    expect(useAuthStore.getState().usuario).toBeNull()
    expect(localStorage.getItem('ITSTOCK_SESSAO')).toBeNull()
  })

  it('restaura o perfil e a marca de senha provisória', async () => {
    authMock.sessaoAtual.mockResolvedValue(sessaoSupabase(ADMIN.email, true))

    expect(await useAuthStore.getState().restaurarSessao()).toBe(true)
    const estado = useAuthStore.getState()
    expect(estado.usuario?.email).toBe(ADMIN.email)
    expect(estado.trocarSenhaPendente).toBe(true)
    expect(JSON.parse(localStorage.getItem('ITSTOCK_SESSAO') ?? 'null').perfil).toBe('Admin')
  })
})

describe('trocarSenha', () => {
  it('libera o bloqueio e audita a troca', async () => {
    authMock.trocarSenhaSupabase.mockResolvedValue({ ok: true })
    useAuthStore.setState({ usuario: ADMIN, trocarSenhaPendente: true })

    const r = await useAuthStore.getState().trocarSenha('senha-definitiva')

    expect(r).toEqual({ ok: true })
    expect(useAuthStore.getState().trocarSenhaPendente).toBe(false)
    const logs = lerColecao<{ acao: string; tabela: string; mensagem?: string }>('LOG')
    expect(logs[0]).toMatchObject({ acao: 'UPDATE', tabela: 'SESSAO', mensagem: 'Senha alterada' })
  })

  it('mantém o bloqueio quando o Supabase recusa a nova senha', async () => {
    authMock.trocarSenhaSupabase.mockResolvedValue({ ok: false, erro: 'Senha muito fraca' })
    useAuthStore.setState({ usuario: ADMIN, trocarSenhaPendente: true })

    const r = await useAuthStore.getState().trocarSenha('123')

    expect(r).toEqual({ ok: false, erro: 'Senha muito fraca' })
    expect(useAuthStore.getState().trocarSenhaPendente).toBe(true)
    expect(lerColecao('LOG')).toHaveLength(0)
  })
})

describe('sair', () => {
  it('limpa a sessão local, encerra a do Supabase e audita', async () => {
    useAuthStore.setState({ usuario: ADMIN, trocarSenhaPendente: true })
    localStorage.setItem('ITSTOCK_SESSAO', JSON.stringify(ADMIN))

    useAuthStore.getState().sair()

    const estado = useAuthStore.getState()
    expect(estado.usuario).toBeNull()
    expect(estado.trocarSenhaPendente).toBe(false)
    expect(localStorage.getItem('ITSTOCK_SESSAO')).toBeNull()
    expect(authMock.sairDoSupabase).toHaveBeenCalled()
    expect(lerColecao<{ acao: string }>('LOG')[0].acao).toBe('LOGOUT')
  })
})
