import { describe, expect, it } from 'vitest'
import {
  conteudoQRAtivo,
  gerarId,
  PREFIXOS,
  proximoCodigoAtivo,
  proximoCodigoItem,
  urlQRCode,
} from './codes'

describe('gerarId', () => {
  it('monta prefixo-ano-sequência com 6 dígitos', () => {
    expect(gerarId('SET', 7, 2026)).toBe('SET-2026-000007')
    expect(gerarId('FOR', 0, 2026)).toBe('FOR-2026-000000')
    expect(gerarId('MOV', 123456, 2025)).toBe('MOV-2025-123456')
  })
})

describe('proximoCodigoAtivo', () => {
  it('usa o prefixo do tipo', () => {
    expect(PREFIXOS['Notebook']).toBe('NOTE')
    expect(proximoCodigoAtivo('Notebook', ['NOTE-001', 'NOTE-003'])).toBe('NOTE-004')
  })

  it('ignora códigos de outros prefixos', () => {
    expect(proximoCodigoAtivo('Monitor', ['CPU-099', 'MON-002'])).toBe('MON-003')
  })

  it('começa em 001 sem existentes', () => {
    expect(proximoCodigoAtivo('Notebook', [])).toBe('NOTE-001')
  })

  it('cai para as 3 primeiras letras de tipos sem prefixo', () => {
    expect(proximoCodigoAtivo('Projetor', [])).toBe('PRO-001')
  })
})

describe('proximoCodigoItem', () => {
  it('incrementa a maior sequência', () => {
    expect(proximoCodigoItem(['Item-003', 'Item-010'])).toBe('Item-011')
  })

  it('ignora valores não numéricos', () => {
    expect(proximoCodigoItem(['Item-abc', 'Item-002'])).toBe('Item-003')
    expect(proximoCodigoItem([])).toBe('Item-001')
  })
})

describe('urlQRCode', () => {
  it('gera URL do quickchart com o texto codificado', () => {
    const url = urlQRCode('CPU-001')
    expect(url).toContain('quickchart.io')
    expect(url).toContain('CPU-001')
    expect(urlQRCode('a b&c')).toContain(encodeURIComponent('a b&c'))
  })
})

describe('conteudoQRAtivo', () => {
  const ativo = {
    codigo: 'NOTE-001',
    descricao: 'Notebook Dell Latitude 5540',
    tombamento: 'TOM-000001',
    setor: 'TI',
    configuracao: 'i7 13ª / 16GB / SSD 512GB',
    marca: 'Dell',
    modelo: 'Latitude 5540',
    responsavel: 'tecnico@empresa.com',
  }

  it('monta todas as linhas da etiqueta na ordem esperada', () => {
    expect(conteudoQRAtivo(ativo)).toBe(
      [
        'NOTE-001',
        'Notebook Dell Latitude 5540',
        'Tomb: TOM-000001',
        'Setor: TI',
        'Config: i7 13ª / 16GB / SSD 512GB',
        'Marca: Dell',
        'Modelo: Latitude 5540',
        'Resp.: tecnico@empresa.com',
      ].join('\n'),
    )
  })

  it('omite tombamento, configuração, marca e modelo vazios', () => {
    const conteudo = conteudoQRAtivo({
      codigo: 'MON-002',
      descricao: 'Monitor Samsung 24" FHD',
      setor: 'Administrativo',
      responsavel: 'gerente@empresa.com',
    })
    expect(conteudo).toBe(
      ['MON-002', 'Monitor Samsung 24" FHD', 'Setor: Administrativo', 'Resp.: gerente@empresa.com'].join(
        '\n',
      ),
    )
  })

  it('gera QR com os dados do equipamento codificados na URL', () => {
    const conteudo = conteudoQRAtivo(ativo)
    const url = urlQRCode(conteudo)
    expect(url).toContain('quickchart.io')
    expect(url).toContain(encodeURIComponent(conteudo))
  })
})
