import { describe, expect, it } from 'vitest'
import { calcularDiferenca, itensParaBanco, paraApp, paraBanco } from './api'

describe('paraBanco', () => {
  it('converte chaves camelCase, datas BR e remove undefined', () => {
    const registro = paraBanco('ATIVOS', {
      codigo: 'NOTE-001',
      descricao: 'Notebook Dell',
      dataAquisicao: '15/03/2025',
      qrUrl: 'https://quickchart.io/qr',
      valorAquisicao: 5490,
      marca: undefined,
      configuracao: 'i7 / 16GB',
    })

    expect(registro).toEqual({
      codigo: 'NOTE-001',
      descricao: 'Notebook Dell',
      data_aquisicao: '2025-03-15',
      qr_url: 'https://quickchart.io/qr',
      valor_aquisicao: 5490,
      configuracao: 'i7 / 16GB',
    })
    expect('marca' in registro).toBe(false)
  })

  it('mantém campos de timestamp como estão', () => {
    const registro = paraBanco('ATIVOS', { codigo: 'X', criadoEm: '2026-10-06T00:37:05.123Z' })
    expect(registro.criado_em).toBe('2026-10-06T00:37:05.123Z')
  })

  it('não mexe em itens das contagens (são tabela separada)', () => {
    const registro = paraBanco('CONTAGENS', {
      id: 'INV-2026-000001',
      nome: 'Contagem A',
      itens: [{ codigoItem: 'Item-001', contado: 3 }],
    })
    expect('itens' in registro).toBe(false)
    expect(registro.id).toBe('INV-2026-000001')
  })
})

describe('paraApp', () => {
  it('converte chaves snake_case, datas ISO, numeric e ignora null', () => {
    const ativo = paraApp('ATIVOS', {
      codigo: 'NOTE-001',
      descricao: 'Notebook Dell',
      data_aquisicao: '2025-03-15',
      valor_aquisicao: '5490.00',
      qr_url: 'qr',
      marca: null,
      criado_em: '2026-10-06T00:37:05.123456+00:00',
      atualizado_em: null,
    })

    expect(ativo).toEqual({
      codigo: 'NOTE-001',
      descricao: 'Notebook Dell',
      dataAquisicao: '15/03/2025',
      valorAquisicao: 5490,
      qrUrl: 'qr',
      criadoEm: '2026-10-06T00:37:05.123Z',
    })
    expect('marca' in ativo).toBe(false)
    expect('atualizadoEm' in ativo).toBe(false)
  })

  it('não transforma texto que parece número (ex.: matrícula)', () => {
    const emprestimo = paraApp('EMPRESTIMOS', { id: 'EMP-1', matricula: '001234' })
    expect(emprestimo.matricula).toBe('001234')
  })

  it('desacha contagem_itens preservando contado null', () => {
    const contagem = paraApp('CONTAGENS', {
      id: 'INV-1',
      nome: 'Contagem A',
      contagem_itens: [
        { codigo_item: 'Item-001', contado: 3, contado_em: '2026-10-06T10:00:00+00:00' },
        { codigo_item: 'Item-002', contado: null, contado_em: null },
      ],
    })

    expect(contagem.itens).toEqual([
      { codigoItem: 'Item-001', contado: 3, contadoEm: '2026-10-06T10:00:00.000Z' },
      { codigoItem: 'Item-002', contado: null },
    ])
    expect('contagem_itens' in contagem).toBe(false)
  })
})

describe('round-trip app ↔ banco', () => {
  it('devolve o mesmo objeto depois de passar pelo banco', () => {
    const ativo = {
      codigo: 'NOTE-001',
      descricao: 'Notebook Dell Latitude 5540',
      tipo: 'Notebook',
      marca: 'Dell',
      configuracao: 'i7 / 16GB',
      setor: 'TI',
      responsavel: 'tecnico@empresa.com',
      status: 'Ativo',
      dataAquisicao: '15/03/2025',
      valorAquisicao: 5490,
      qrUrl: 'qr',
      criadoEm: '2026-10-06T00:37:05.123Z',
      atualizadoEm: '2026-10-06T00:37:05.123Z',
    }
    expect(paraApp('ATIVOS', paraBanco('ATIVOS', ativo))).toEqual(ativo)
  })

  it('gera linhas de contagem_itens com a FK certa', () => {
    expect(
      itensParaBanco({
        id: 'INV-1',
        itens: [
          { codigoItem: 'Item-001', contado: 3, contadoEm: '06/10/2026' },
          { codigoItem: 'Item-002', contado: null },
        ],
      }),
    ).toEqual([
      { contagem_id: 'INV-1', codigo_item: 'Item-001', contado: 3, contado_em: '2026-10-06' },
      { contagem_id: 'INV-1', codigo_item: 'Item-002', contado: null },
    ])
  })
})

describe('calcularDiferenca', () => {
  it('só marca como mudança o que realmente mudou', () => {
    const antes = [
      { codigo: 'NOTE-001', descricao: 'Notebook', marca: undefined, notas: 'a' },
      { codigo: 'NOTE-002', descricao: 'Notebook velho' },
    ]
    const depois = [
      { codigo: 'NOTE-001', descricao: 'Notebook', marca: undefined, notas: 'b' },
      { codigo: 'NOTE-003', descricao: 'Monitor' },
    ]

    const { mudancas, removidos } = calcularDiferenca('ATIVOS', antes, depois)

    expect(mudancas.map((r) => r.codigo)).toEqual(['NOTE-001', 'NOTE-003'])
    expect(removidos).toEqual(['NOTE-002'])
  })

  it('não gera mudança quando só muda undefined para ausente', () => {
    const antes = [{ codigo: 'NOTE-001', marca: undefined }]
    const depois = [{ codigo: 'NOTE-001' }]
    expect(calcularDiferenca('ATIVOS', antes, depois).mudancas).toEqual([])
  })
})
