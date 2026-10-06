import { beforeEach, describe, expect, it } from 'vitest'
import { conteudoQRAtivo, urlQRCode } from '../lib/codes'
import type { Ativo, LogEntrada } from '../types'
import { lerColecao } from '../data/repository'
import { useAtivosStore } from './ativos'

function ativoBase(extra: Partial<Ativo> = {}): Ativo {
  return {
    codigo: 'NOTE-001',
    descricao: 'Notebook Dell Latitude 5540',
    tipo: 'Notebook',
    marca: 'Dell',
    modelo: 'Latitude 5540',
    setor: 'TI',
    responsavel: 'tecnico@empresa.com',
    status: 'Ativo',
    dataAquisicao: '15/03/2025',
    qrUrl: urlQRCode('NOTE-001'),
    criadoEm: '2025-03-15T13:00:00.000Z',
    atualizadoEm: '2025-03-15T13:00:00.000Z',
    ...extra,
  }
}

describe('useAtivosStore — QR com os dados do equipamento', () => {
  beforeEach(() => {
    localStorage.clear()
    useAtivosStore.setState({ ativos: [] })
  })

  it('criar grava qrUrl com código, setor e responsável', () => {
    const ativo = useAtivosStore.getState().criar({
      descricao: 'Monitor Dell 24',
      tipo: 'Monitor',
      marca: 'Dell',
      configuracao: '24" IPS 1080p 75Hz',
      setor: 'TI',
      responsavel: 'tecnico@empresa.com',
      dataAquisicao: '01/10/2026',
      tombamento: 'TOM-000099',
    })

    const esperado = urlQRCode(conteudoQRAtivo(ativo))
    expect(ativo.qrUrl).toBe(esperado)
    expect(ativo.qrUrl).toContain(encodeURIComponent('Config: 24" IPS 1080p 75Hz'))
    expect(ativo.qrUrl).toContain(encodeURIComponent('Tomb: TOM-000099'))
  })

  it('atualizar recalcula qrUrl quando mudam setor, configuração ou responsável', () => {
    const base = ativoBase()
    useAtivosStore.setState({ ativos: [base] })
    expect(base.qrUrl).toBe(urlQRCode('NOTE-001'))

    useAtivosStore.getState().atualizar('NOTE-001', {
      setor: 'Financeiro',
      configuracao: 'i5 / 8GB / SSD 256GB',
      responsavel: 'viewer@empresa.com',
    })

    const [atualizado] = useAtivosStore.getState().ativos
    expect(atualizado.qrUrl).toBe(urlQRCode(conteudoQRAtivo(atualizado)))
    expect(atualizado.qrUrl).toContain(encodeURIComponent('Setor: Financeiro'))
    expect(atualizado.qrUrl).toContain(encodeURIComponent('Config: i5 / 8GB / SSD 256GB'))
    expect(atualizado.qrUrl).toContain(encodeURIComponent('Resp.: viewer@empresa.com'))

    const logs = lerColecao<LogEntrada>('LOG')
    expect(logs).toHaveLength(1)
    expect(logs[0].acao).toBe('UPDATE')
    expect(logs[0].tabela).toBe('ATIVOS')
    expect(logs[0].registroId).toBe('NOTE-001')
  })
})
