import { beforeEach, describe, expect, it } from 'vitest'
import { lerColecao } from '../data/repository'
import { hojeBR, somarDiasBR } from '../lib/format'
import type { Ativo, Emprestimo, LogEntrada } from '../types'
import { useAuthStore } from './auth'
import { emprestimoAtrasado, useEmprestimosStore, type DadosEmprestimo } from './emprestimos'

const ATIVO: Ativo = {
  codigo: 'NOTE-001',
  descricao: 'Notebook Dell Latitude 5540',
  tipo: 'Notebook',
  setor: 'TI',
  responsavel: 'tecnico@empresa.com',
  status: 'Ativo',
  dataAquisicao: '15/03/2025',
  qrUrl: '',
  criadoEm: '2025-03-15T13:00:00.000Z',
  atualizadoEm: '2025-03-15T13:00:00.000Z',
}

const ATIVO_DESCARTADO: Ativo = {
  ...ATIVO,
  codigo: 'IMP-001',
  descricao: 'Impressora HP',
  status: 'Descartado',
}

function dados(parciais: Partial<DadosEmprestimo> = {}): DadosEmprestimo {
  return {
    codigoAtivo: 'NOTE-001',
    funcionario: 'Mariana Costa',
    matricula: '1042',
    setor: 'Vendas',
    dataEmprestimo: hojeBR(),
    previsaoDevolucao: somarDiasBR(hojeBR(), 7),
    observacao: 'Home office',
    ...parciais,
  }
}

function sessao(perfil: 'Admin' | 'Gerente' | 'Técnico' | 'Visualizador'): void {
  useAuthStore.setState({
    usuario: {
      email: `${perfil.toLowerCase()}@empresa.com`,
      nome: 'Pessoa Teste',
      perfil,
      setor: 'TI',
      status: 'Ativo',
    },
  })
}

function emprestimoAtivo(sobrescrever: Partial<Emprestimo> = {}): Emprestimo {
  return {
    id: 'EMP-2026-000009',
    codigoAtivo: 'NOTE-001',
    funcionario: 'Mariana Costa',
    setor: 'Vendas',
    dataEmprestimo: hojeBR(),
    previsaoDevolucao: somarDiasBR(hojeBR(), 7),
    status: 'Em aberto',
    registradoPor: 'admin@empresa.com',
    criadoEm: '2026-10-05T13:00:00.000Z',
    atualizadoEm: '2026-10-05T13:00:00.000Z',
    ...sobrescrever,
  }
}

describe('useEmprestimosStore', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('ITSTOCK_ATIVOS', JSON.stringify([ATIVO, ATIVO_DESCARTADO]))
    sessao('Admin')
    useEmprestimosStore.setState({ emprestimos: [] })
  })

  it('cria o empréstimo com id EMP-2026-… e registra CREATE na auditoria', () => {
    const resultado = useEmprestimosStore.getState().emprestar(dados())

    expect(resultado).toEqual({ ok: true })

    const lista = useEmprestimosStore.getState().emprestimos
    expect(lista).toHaveLength(1)
    expect(lista[0].id).toBe('EMP-2026-000001')
    expect(lista[0].status).toBe('Em aberto')
    expect(lista[0].registradoPor).toBe('admin@empresa.com')

    const logs = lerColecao<LogEntrada>('LOG')
    expect(logs).toHaveLength(1)
    expect(logs[0].acao).toBe('CREATE')
    expect(logs[0].tabela).toBe('EMPRESTIMOS')
    expect(logs[0].registroId).toBe('EMP-2026-000001')
    expect(logs[0].campos.find((c) => c.campo === 'funcionario')?.depois).toBe('Mariana Costa')
  })

  it('bloqueia emprestar o mesmo equipamento duas vezes enquanto estiver em aberto', () => {
    expect(useEmprestimosStore.getState().emprestar(dados()).ok).toBe(true)

    const segundo = useEmprestimosStore.getState().emprestar(dados())

    expect(segundo.ok).toBe(false)
    expect(segundo.erro).toContain('já está emprestado')
    expect(useEmprestimosStore.getState().emprestimos).toHaveLength(1)
  })

  it('libera o equipamento novamente após a devolução', () => {
    useEmprestimosStore.getState().emprestar(dados())
    const id = useEmprestimosStore.getState().emprestimos[0].id

    expect(useEmprestimosStore.getState().devolver(id).ok).toBe(true)
    expect(useEmprestimosStore.getState().emprestar(dados()).ok).toBe(true)
    expect(useEmprestimosStore.getState().emprestimos).toHaveLength(2)
  })

  it('recusa equipamento descartado, funcionário curto e datas inválidas', () => {
    const descartado = useEmprestimosStore.getState().emprestar({
      ...dados(),
      codigoAtivo: 'IMP-001',
    })
    expect(descartado.ok).toBe(false)
    expect(descartado.erro).toContain('descartado')

    const curto = useEmprestimosStore.getState().emprestar({ ...dados(), funcionario: 'An' })
    expect(curto.ok).toBe(false)
    expect(curto.erro).toContain('mínimo 3 letras')

    const semSetor = useEmprestimosStore.getState().emprestar({ ...dados(), setor: '  ' })
    expect(semSetor.ok).toBe(false)
    expect(semSetor.erro).toContain('setor')

    const dataInvalida = useEmprestimosStore.getState().emprestar({
      ...dados(),
      dataEmprestimo: '2026-10-05',
    })
    expect(dataInvalida.ok).toBe(false)
    expect(dataInvalida.erro).toContain('Data do empréstimo')

    const invertida = useEmprestimosStore.getState().emprestar({
      ...dados(),
      previsaoDevolucao: somarDiasBR(hojeBR(), -3),
    })
    expect(invertida.ok).toBe(false)
    expect(invertida.erro).toContain('anterior')

    const inexistente = useEmprestimosStore.getState().emprestar({
      ...dados(),
      codigoAtivo: 'NOTE-999',
    })
    expect(inexistente.ok).toBe(false)
    expect(inexistente.erro).toContain('não encontrado')

    expect(useEmprestimosStore.getState().emprestimos).toHaveLength(0)
  })

  it('registra a devolução com data, responsável e diff na auditoria', () => {
    useEmprestimosStore.getState().emprestar(dados())
    const id = useEmprestimosStore.getState().emprestimos[0].id

    const resultado = useEmprestimosStore.getState().devolver(id, 'Sem avarias')

    expect(resultado).toEqual({ ok: true })
    const devolvido = useEmprestimosStore.getState().emprestimos[0]
    expect(devolvido.status).toBe('Devolvido')
    expect(devolvido.dataDevolucao).toBe(hojeBR())
    expect(devolvido.observacaoDevolucao).toBe('Sem avarias')
    expect(devolvido.devolvidoPor).toBe('admin@empresa.com')

    const logs = lerColecao<LogEntrada>('LOG')
    expect(logs[0].acao).toBe('UPDATE')
    expect(logs[0].tabela).toBe('EMPRESTIMOS')
    expect(logs[0].campos.find((c) => c.campo === 'status')?.antes).toBe('Em aberto')
    expect(logs[0].campos.find((c) => c.campo === 'status')?.depois).toBe('Devolvido')
  })

  it('recusa devolver empréstimo que não está em aberto', () => {
    useEmprestimosStore.setState({ emprestimos: [emprestimoAtivo({ status: 'Devolvido' })] })

    const resultado = useEmprestimosStore
      .getState()
      .devolver('EMP-2026-000009')

    expect(resultado.ok).toBe(false)
    expect(resultado.erro).toContain('finalizado')
    expect(lerColecao<LogEntrada>('LOG')).toHaveLength(0)
  })

  it('só Admin e Gerente podem cancelar, e apenas o que está em aberto', () => {
    useEmprestimosStore.setState({ emprestimos: [emprestimoAtivo()] })

    sessao('Técnico')
    const negado = useEmprestimosStore.getState().cancelar('EMP-2026-000009')
    expect(negado.ok).toBe(false)
    expect(negado.erro).toContain('Admin e Gerente')

    sessao('Gerente')
    const aceito = useEmprestimosStore.getState().cancelar('EMP-2026-000009')
    expect(aceito).toEqual({ ok: true })
    expect(useEmprestimosStore.getState().emprestimos[0].status).toBe('Cancelado')
    expect(lerColecao<LogEntrada>('LOG')[0].acao).toBe('UPDATE')

    const repetido = useEmprestimosStore.getState().cancelar('EMP-2026-000009')
    expect(repetido.ok).toBe(false)
  })

  it('marca como atrasado apenas o que passou da previsão e está em aberto', () => {
    expect(emprestimoAtrasado(emprestimoAtivo())).toBe(false)
    expect(
      emprestimoAtrasado(
        emprestimoAtivo({ previsaoDevolucao: somarDiasBR(hojeBR(), -1) }),
      ),
    ).toBe(true)
    expect(
      emprestimoAtrasado(
        emprestimoAtivo({
          status: 'Devolvido',
          previsaoDevolucao: somarDiasBR(hojeBR(), -5),
        }),
      ),
    ).toBe(false)
  })
})
