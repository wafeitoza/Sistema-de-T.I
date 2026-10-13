import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  modoSupabase: true,
  proximaSequencia: vi.fn(),
}))

// espelho em memória: o teste só quer saber de onde vem o CÓDIGO
const espelho = new Map<string, unknown[]>()

vi.mock('../data/client', () => ({
  get modoSupabase() {
    return mocks.modoSupabase
  },
  cliente: vi.fn(),
}))
vi.mock('../data/repository', () => ({
  lerColecao: (colecao: string) => (espelho.get(colecao) ?? []) as never[],
  gravarColecao: (colecao: string, dados: unknown[]) => espelho.set(colecao, dados),
  proximaSequencia: mocks.proximaSequencia,
}))

async function carregar() {
  const [{ useAtivosStore }, { useEstoqueStore }] = await Promise.all([
    import('./ativos'),
    import('./estoque'),
  ])
  // os stores leem o espelho na criação; recarrega para o caso de o teste
  // ter gravado depois do import
  useAtivosStore.getState().recarregar()
  useEstoqueStore.getState().recarregar()
  return { ativos: useAtivosStore, estoque: useEstoqueStore }
}

const NOVO = {
  descricao: 'Notebook Dell',
  tipo: 'Notebook',
  setor: 'TI',
  responsavel: 'tecnico@empresa.com',
  dataAquisicao: '01/10/2026',
}

beforeEach(() => {
  vi.resetModules()
  espelho.clear()
  mocks.modoSupabase = true
  mocks.proximaSequencia.mockReset().mockImplementation((nome: string) => {
    const valor = Number(espelho.get(`SEQ:${nome}`)?.[0] ?? 0) + 1
    espelho.set(`SEQ:${nome}`, [valor])
    return valor
  })
})

describe('modo Supabase — código vem da sequência do servidor', () => {
  it('ativo novo consome a sequência do prefixo (ATV_NOTE)', async () => {
    const { ativos } = await carregar()
    // espelho já tem um NOTE-001 que NÃO é lido: o número vem do servidor
    espelho.set('ATIVOS', [{ codigo: 'NOTE-001' }])

    const criado = ativos.getState().criar({ ...NOVO })
    expect(mocks.proximaSequencia).toHaveBeenCalledWith('ATV_NOTE')
    expect(criado.codigo).toBe('NOTE-001') // servidor devolveu 1
  })

  it('dois ativos seguidos não repetem código (sequência é bloco do servidor)', async () => {
    const { ativos } = await carregar()
    espelho.set('ATIVOS', [{ codigo: 'NOTE-001' }])

    const a = ativos.getState().criar({ ...NOVO })
    const b = ativos.getState().criar({ ...NOVO, descricao: 'Notebook Lenovo' })
    expect(a.codigo).toBe('NOTE-001')
    expect(b.codigo).toBe('NOTE-002')
  })

  it('cada tipo de ativo tem a sua sequência', async () => {
    const { ativos } = await carregar()
    ativos.getState().criar({ ...NOVO })
    ativos.getState().criar({ ...NOVO, tipo: 'Monitor', descricao: 'Monitor Dell' })
    expect(mocks.proximaSequencia).toHaveBeenCalledWith('ATV_NOTE')
    expect(mocks.proximaSequencia).toHaveBeenCalledWith('ATV_MON')
  })

  it('item de estoque consome a sequência ITEM', async () => {
    const { estoque } = await carregar()
    espelho.set('ESTOQUE', [{ codigo: 'Item-009' }])

    const item = estoque.getState().criarItem({
      descricao: 'Cabo de rede Cat6',
      categoria: 'Cables',
      unidade: 'Peça',
      quantidadeMinima: 10,
    })
    expect(mocks.proximaSequencia).toHaveBeenCalledWith('ITEM')
    expect(item.codigo).toBe('Item-001') // o espelho local não manda
  })
})

describe('modo local — código continua saindo do espelho', () => {
  beforeEach(() => {
    mocks.modoSupabase = false
  })

  it('ativo novo usa o maior código existente', async () => {
    // o espelho precisa estar gravado ANTES de o store criar o estado
    espelho.set('ATIVOS', [{ codigo: 'NOTE-001' }, { codigo: 'NOTE-004' }])
    const { ativos } = await carregar()

    const criado = ativos.getState().criar({ ...NOVO })
    expect(criado.codigo).toBe('NOTE-005')
    // o único consumo é o do LOG do audit — nada de ATV_NOTE
    expect(mocks.proximaSequencia).not.toHaveBeenCalledWith('ATV_NOTE')
  })

  it('item de estoque usa o maior código existente', async () => {
    espelho.set('ESTOQUE', [{ codigo: 'Item-003' }])
    const { estoque } = await carregar()

    const item = estoque.getState().criarItem({
      descricao: 'Mouse USB',
      categoria: 'Periféricos',
      unidade: 'Peça',
      quantidadeMinima: 5,
    })
    expect(item.codigo).toBe('Item-004')
  })
})
