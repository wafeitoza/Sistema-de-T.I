import { describe, expect, it } from 'vitest'
import { calcularHashTermo, conteudoPadrao, integridadeOK, montarPayload } from './termos'

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
