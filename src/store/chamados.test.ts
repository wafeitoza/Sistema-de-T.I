import { beforeEach, describe, expect, it } from 'vitest'
import type { Chamado, ChamadoMensagem } from '../types'
import { useAuthStore } from './auth'
import {
  mensagensDo,
  perfilOperaChamados,
  transicaoPermitida,
  useChamadosStore,
  type DadosChamado,
} from './chamados'

// Mapa explícito: `perfil.toLowerCase()` geraria 'técnico@empresa.com', com
// acento — e-mail real não tem acento, e a asserção depois esconderia isso.
const EMAIL_PERFIL: Record<string, string> = {
  Admin: 'admin@empresa.com',
  Gerente: 'gerente@empresa.com',
  Técnico: 'tecnico@empresa.com',
  Visualizador: 'visualizador@empresa.com',
}

function sessao(perfil: 'Admin' | 'Gerente' | 'Técnico' | 'Visualizador'): void {
  useAuthStore.setState({
    usuario: {
      email: EMAIL_PERFIL[perfil],
      nome: 'Pessoa Teste',
      perfil,
      setor: 'TI',
      status: 'Ativo',
    },
  })
}

function dados(parciais: Partial<DadosChamado> = {}): DadosChamado {
  return {
    assunto: 'Notebook não liga',
    descricao: 'LED acende e apaga em seguida',
    solicitante: 'mariana@empresa.com',
    prioridade: 'Média',
    ...parciais,
  }
}

function chamadoAberto(): Chamado {
  const store = useChamadosStore.getState()
  const r = store.abrir(dados())
  expect(r.ok).toBe(true)
  return useChamadosStore.getState().chamados[0]
}

function mensagem(id: string, recebidoEm: string): ChamadoMensagem {
  return {
    id,
    chamadoId: 'CHM-2026-000001',
    direcao: 'recebida',
    remetente: 'mariana@empresa.com',
    corpo: 'corpo',
    recebidoEm,
    criadoEm: recebidoEm,
  }
}

beforeEach(() => {
  useChamadosStore.setState({ chamados: [], mensagens: [] })
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const chave = localStorage.key(i)
    if (chave?.startsWith('ITSTOCK_')) localStorage.removeItem(chave)
  }
  sessao('Técnico')
})

describe('abrir chamado', () => {
  it('cria em aberto, manual, numerado pela sequência CHM', () => {
    const c = chamadoAberto()

    expect(c.id).toMatch(/^CHM-\d{4}-\d{6}$/)
    expect(c.status).toBe('Aberto')
    expect(c.origem).toBe('Manual')
    expect(c.solicitante).toBe('mariana@empresa.com')
    expect(c.registradoPor).toBe('tecnico@empresa.com')
  })

  it('normaliza o e-mail do solicitante para minúsculas', () => {
    sessao('Admin')
    useChamadosStore.getState().abrir(dados({ solicitante: 'Mariana@Empresa.COM' }))
    expect(useChamadosStore.getState().chamados[0].solicitante).toBe('mariana@empresa.com')
  })

  it('recusa assunto curto e e-mail malformado', () => {
    expect(useChamadosStore.getState().abrir(dados({ assunto: 'ok' })).ok).toBe(false)
    expect(useChamadosStore.getState().abrir(dados({ solicitante: 'sem-arroba' })).ok).toBe(false)
    expect(useChamadosStore.getState().chamados).toHaveLength(0)
  })

  it('Visualizador não abre chamado', () => {
    sessao('Visualizador')
    expect(useChamadosStore.getState().abrir(dados()).ok).toBe(false)
    expect(useChamadosStore.getState().chamados).toHaveLength(0)
  })
})

describe('atribuição e status', () => {
  it('atribuir assume o atendimento de um chamado em aberto', () => {
    const c = chamadoAberto()
    const r = useChamadosStore.getState().atribuir(c.id, 'Tecnico@empresa.com')

    expect(r.ok).toBe(true)
    expect(useChamadosStore.getState().chamados[0]).toMatchObject({
      atribuidoA: 'tecnico@empresa.com',
      status: 'Em atendimento',
    })
  })

  it('não muda para Em atendimento sem responsável', () => {
    const c = chamadoAberto()
    const r = useChamadosStore.getState().mudarStatus(c.id, 'Em atendimento')

    expect(r.ok).toBe(false)
    expect(r.erro).toContain('atender')
    expect(useChamadosStore.getState().chamados[0].status).toBe('Aberto')
  })

  it('resolver preenche quem resolveu e quando', () => {
    const c = chamadoAberto()
    useChamadosStore.getState().atribuir(c.id, 'tecnico@empresa.com')
    const r = useChamadosStore.getState().mudarStatus(c.id, 'Resolvido')

    expect(r.ok).toBe(true)
    expect(useChamadosStore.getState().chamados[0]).toMatchObject({
      status: 'Resolvido',
      resolvidoPor: 'tecnico@empresa.com',
    })
    expect(useChamadosStore.getState().chamados[0].resolvidoEm).toBeTruthy()
  })

  it('um chamado resolvido volta para Em atendimento (resolver por engano)', () => {
    const c = chamadoAberto()
    useChamadosStore.getState().atribuir(c.id, 'tecnico@empresa.com')
    useChamadosStore.getState().mudarStatus(c.id, 'Resolvido')

    const r = useChamadosStore.getState().mudarStatus(c.id, 'Em atendimento')
    expect(r.ok).toBe(true)
    expect(useChamadosStore.getState().chamados[0].status).toBe('Em atendimento')
  })

  it('Cancelado é terminal', () => {
    const c = chamadoAberto()
    expect(useChamadosStore.getState().mudarStatus(c.id, 'Cancelado').ok).toBe(true)
    expect(useChamadosStore.getState().mudarStatus(c.id, 'Aberto').ok).toBe(false)
    expect(useChamadosStore.getState().chamados[0].status).toBe('Cancelado')
  })

  it('gravador de auditoria registra a abertura', () => {
    chamadoAberto()
    const logs = JSON.parse(localStorage.getItem('ITSTOCK_LOG') ?? '[]') as { tabela: string }[]
    expect(logs.some((l) => l.tabela === 'CHAMADOS')).toBe(true)
  })
})

describe('regras de transição', () => {
  it('permite os caminhos do ciclo de vida', () => {
    expect(transicaoPermitida('Aberto', 'Em atendimento')).toBe(true)
    expect(transicaoPermitida('Aberto', 'Aguardando usuário')).toBe(true)
    expect(transicaoPermitida('Aguardando usuário', 'Em atendimento')).toBe(true)
    expect(transicaoPermitida('Resolvido', 'Em atendimento')).toBe(true)
  })

  it('nega atalhos que esconderiam histórico', () => {
    expect(transicaoPermitida('Resolvido', 'Cancelado')).toBe(false)
    expect(transicaoPermitida('Cancelado', 'Aberto')).toBe(false)
    expect(transicaoPermitida('Cancelado', 'Resolvido')).toBe(false)
  })

  it('só quem opera a fila mexe em chamado', () => {
    expect(perfilOperaChamados('Admin')).toBe(true)
    expect(perfilOperaChamados('Gerente')).toBe(true)
    expect(perfilOperaChamados('Técnico')).toBe(true)
    expect(perfilOperaChamados('Visualizador')).toBe(false)
    expect(perfilOperaChamados(undefined)).toBe(false)
  })
})

describe('fio de mensagens', () => {
  it('anexa sem duplicar o mesmo id', () => {
    useChamadosStore.getState().anexarMensagem(mensagem('CMM-1', '2026-10-15T10:00:00.000Z'))
    useChamadosStore.getState().anexarMensagem(mensagem('CMM-1', '2026-10-15T10:00:00.000Z'))
    useChamadosStore.getState().anexarMensagem(mensagem('CMM-2', '2026-10-15T11:00:00.000Z'))

    expect(useChamadosStore.getState().mensagens).toHaveLength(2)
  })

  it('lista só as mensagens do chamado, em ordem cronológica', () => {
    useChamadosStore.setState({
      mensagens: [
        mensagem('CMM-3', '2026-10-15T12:00:00.000Z'),
        mensagem('CMM-1', '2026-10-15T10:00:00.000Z'),
        { ...mensagem('CMM-9', '2026-10-15T09:00:00.000Z'), chamadoId: 'CHM-2026-000002' },
      ],
    })

    const fio = mensagensDo(useChamadosStore.getState().mensagens, 'CHM-2026-000001')
    expect(fio.map((m) => m.id)).toEqual(['CMM-1', 'CMM-3'])
  })
})
