import { describe, expect, it } from 'vitest'
import type { Ativo } from '../types'
import {
  acharTermoDoEmprestimo,
  calcularHashTermo,
  conteudoPadrao,
  conteudoTermoEmprestimo,
  dadosTermoDeEmprestimo,
  integridadeOK,
  montarPayload,
} from './termos'

const termo = {
  id: 'TERM-2026-000001',
  ativoCodigo: 'CPU-001',
  responsavel: 'tecnico@empresa.com',
  conteudo: 'TERMO DE TESTE',
  status: 'Pendente' as const,
  hash: '',
  criadoEm: '2026-10-01T12:00:00.000Z',
  criadoPor: 'admin@empresa.com',
}

describe('montarPayload', () => {
  it('monta JSON com os campos de integridade na ordem esperada', () => {
    expect(montarPayload(termo)).toBe(
      '{"ativoCodigo":"CPU-001","responsavel":"tecnico@empresa.com","conteudo":"TERMO DE TESTE","criadoEm":"2026-10-01T12:00:00.000Z","criadoPor":"admin@empresa.com"}',
    )
  })
})

describe('calcularHashTermo', () => {
  it('gera o SHA-256 conhecido do payload', async () => {
    const hash = await calcularHashTermo(termo)
    expect(hash).toBe('5266f61636703ff8e50cb58801ff6292140a3844b59cad3ff2c2b74a057d3461')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('integridadeOK', () => {
  it('confere hash íntegro', async () => {
    const hash = await calcularHashTermo(termo)
    expect(await integridadeOK({ ...termo, hash })).toBe(true)
  })

  it('detecta adulteração do conteúdo', async () => {
    const hash = await calcularHashTermo(termo)
    expect(await integridadeOK({ ...termo, conteudo: 'OUTRO', hash })).toBe(false)
  })

  it('rejeita hash vazio ou divergente', async () => {
    expect(await integridadeOK({ ...termo, hash: '' })).toBe(false)
    expect(await integridadeOK({ ...termo, hash: 'x'.repeat(64) })).toBe(false)
  })
})

describe('conteudoPadrao', () => {
  it('inclui código, descrição, setor e responsável', () => {
    const texto = conteudoPadrao(
      {
        codigo: 'CPU-001',
        descricao: 'Optiplex 7090',
        tipo: 'Desktop',
        marca: 'Dell',
        modelo: '7090',
        setor: 'TI',
        responsavel: 'tecnico@empresa.com',
        status: 'Ativo',
        dataAquisicao: '01/10/2026',
        qrUrl: '',
        criadoEm: '2026-10-01T12:00:00.000Z',
        atualizadoEm: '2026-10-01T12:00:00.000Z',
      },
      'tecnico@empresa.com',
    )
    expect(texto).toContain('CPU-001')
    expect(texto).toContain('tecnico@empresa.com')
    expect(texto).toContain('TI')
    expect(texto).toContain('Optiplex 7090')
    expect(texto).toContain('Dell 7090')
  })
})

const ativoNotebook: Ativo = {
  codigo: 'NB-014',
  descricao: 'Notebook Latitude',
  tipo: 'Notebook',
  marca: 'Dell',
  modelo: 'Latitude 5440',
  serial: 'SRV-998877',
  tombamento: 'T-4412',
  setor: 'TI',
  responsavel: 'tecnico@empresa.com',
  status: 'Ativo',
  dataAquisicao: '01/10/2026',
  qrUrl: '',
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
}

const emprestimoBase = {
  codigoAtivo: 'NB-014',
  funcionario: 'Joao da Silva',
  matricula: '4321',
  setor: 'Vendas',
  dataEmprestimo: '10/10/2026',
  previsaoDevolucao: '17/10/2026',
}

describe('conteudoTermoEmprestimo', () => {
  const texto = conteudoTermoEmprestimo(dadosTermoDeEmprestimo(emprestimoBase, ativoNotebook))

  it('traz o nome do funcionário que vai usar o equipamento', () => {
    expect(texto).toContain('Eu, Joao da Silva, matricula nº 4321')
  })

  it('traz o tipo de equipamento como primeiro dado de identificação', () => {
    expect(texto).toContain('Tipo de equipamento: Notebook')
    expect(texto.indexOf('Tipo de equipamento:')).toBeLessThan(texto.indexOf('Codigo: NB-014'))
  })

  it('identifica o equipamento pelo código, descrição, modelo, série e tombamento', () => {
    expect(texto).toContain('Codigo: NB-014')
    expect(texto).toContain('Descricao: Notebook Latitude')
    expect(texto).toContain('Marca/modelo: Dell Latitude 5440')
    expect(texto).toContain('Numero de serie: SRV-998877')
    expect(texto).toContain('Tombamento: T-4412')
  })

  it('traz setor, prazo e linha de assinatura do responsável', () => {
    expect(texto).toContain('do setor Vendas')
    expect(texto).toContain('Data do emprestimo: 10/10/2026')
    expect(texto).toContain('Previsao de devolucao: 17/10/2026')
    expect(texto).toContain('Joao da Silva — responsavel')
  })

  it('omite matrícula, série e tombamento quando não informados', () => {
    const simples = conteudoTermoEmprestimo({
      codigoAtivo: 'CPU-001',
      descricao: 'Optiplex',
      tipo: 'Desktop',
      setor: 'TI',
      funcionario: 'Maria',
      dataEmprestimo: '10/10/2026',
      previsaoDevolucao: '17/10/2026',
    })
    expect(simples).not.toContain('matricula')
    expect(simples).not.toContain('Numero de serie')
    expect(simples).not.toContain('Tombamento')
    expect(simples).toContain('Tipo de equipamento: Desktop')
  })

  it('é determinístico: os mesmos dados geram sempre o mesmo texto', () => {
    expect(conteudoTermoEmprestimo(dadosTermoDeEmprestimo(emprestimoBase, ativoNotebook))).toBe(
      texto,
    )
  })
})

describe('dadosTermoDeEmprestimo', () => {
  it('monta o termo a partir do empréstimo e do cadastro do ativo', () => {
    const dados = dadosTermoDeEmprestimo(emprestimoBase, ativoNotebook)
    expect(dados).toMatchObject({
      codigoAtivo: 'NB-014',
      tipo: 'Notebook',
      funcionario: 'Joao da Silva',
      matricula: '4321',
      setor: 'Vendas',
      dataEmprestimo: '10/10/2026',
      previsaoDevolucao: '17/10/2026',
    })
  })

  it('não quebra com equipamento fora do cadastro', () => {
    const dados = dadosTermoDeEmprestimo(emprestimoBase, undefined)
    expect(dados.tipo).toBe('')
    expect(dados.descricao).toBe('')
    const texto = conteudoTermoEmprestimo(dados)
    expect(texto).not.toContain('Tipo de equipamento')
    expect(texto).toContain('Codigo: NB-014')
    expect(texto).toContain('Eu, Joao da Silva')
  })
})

describe('acharTermoDoEmprestimo', () => {
  const termoDoEmprestimo = {
    ...termo,
    id: 'TERM-2026-000042',
    ativoCodigo: 'NB-014',
    responsavel: 'Joao da Silva',
    conteudo: conteudoTermoEmprestimo(dadosTermoDeEmprestimo(emprestimoBase, ativoNotebook)),
  }

  it('encontra o termo gerado para o empréstimo, ignorando os demais', () => {
    const achado = acharTermoDoEmprestimo([termo, termoDoEmprestimo], emprestimoBase, ativoNotebook)
    expect(achado?.id).toBe('TERM-2026-000042')
  })

  it('não encontra nada para outro empréstimo', () => {
    const outro = { ...emprestimoBase, funcionario: 'Outra Pessoa' }
    expect(acharTermoDoEmprestimo([termoDoEmprestimo], outro, ativoNotebook)).toBeUndefined()
  })
})
