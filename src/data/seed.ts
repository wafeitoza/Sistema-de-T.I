import { gravarColecao } from './repository'
import { urlQRCode } from '../lib/codes'
import { hojeBR, somarDiasBR } from '../lib/format'
import type {
  Ativo,
  Contagem,
  Emprestimo,
  Entrada,
  Fornecedor,
  ItemEstoque,
  Manutencao,
  Movimentacao,
  Saida,
  Solicitacao,
  Usuario,
} from '../types'

export const FORNECEDORES = [
  'Chipart Informática',
  'Digital Store LTDA',
  'Kabum! Corporativo',
  'Dell Brasil',
  'Positivo Tech',
]

const USUARIOS: Usuario[] = [
  {
    email: 'admin@empresa.com',
    nome: 'Alice Admin',
    perfil: 'Admin',
    setor: 'TI',
    status: 'Ativo',
    telefone: '(11) 99999-0001',
  },
  {
    email: 'gerente@empresa.com',
    nome: 'Bruno Gerente',
    perfil: 'Gerente',
    setor: 'TI',
    status: 'Ativo',
    telefone: '(11) 99999-0002',
  },
  {
    email: 'tecnico@empresa.com',
    nome: 'Carla Técnica',
    perfil: 'Técnico',
    setor: 'TI',
    status: 'Ativo',
    telefone: '(11) 99999-0003',
  },
  {
    email: 'viewer@empresa.com',
    nome: 'Diego Visual',
    perfil: 'Visualizador',
    setor: 'Financeiro',
    status: 'Ativo',
    telefone: '(11) 99999-0004',
  },
]

function ativoBase(
  codigo: string,
  descricao: string,
  tipo: string,
  setor: string,
  responsavel: string,
  extra: Partial<Ativo> = {},
): Ativo {
  return {
    codigo,
    descricao,
    tipo,
    setor,
    responsavel,
    status: 'Ativo',
    dataAquisicao: '15/03/2025',
    qrUrl: urlQRCode(codigo),
    criadoEm: '2025-03-15T13:00:00.000Z',
    atualizadoEm: '2025-03-15T13:00:00.000Z',
    ...extra,
  }
}

const ATIVOS: Ativo[] = [
  ativoBase('NOTE-001', 'Notebook Dell Latitude 5540', 'Notebook', 'TI', 'tecnico@empresa.com', {
    marca: 'Dell',
    modelo: 'Latitude 5540',
    serial: 'DL5540-9921',
    valorAquisicao: 5490,
    localizacao: 'Sala TI - Armário 1',
    dataAquisicao: '15/03/2025',
    proximaManutencao: '05/12/2026',
    ultimaManutencao: '06/09/2026',
  }),
  ativoBase('NOTE-002', 'Notebook Lenovo ThinkPad E14', 'Notebook', 'Financeiro', 'viewer@empresa.com', {
    marca: 'Lenovo',
    modelo: 'ThinkPad E14',
    serial: 'LN14-3310',
    valorAquisicao: 4890,
    localizacao: 'Sala Financeiro - Mesa 3',
    dataAquisicao: '02/07/2025',
    proximaManutencao: '20/10/2026',
    ultimaManutencao: '21/07/2026',
  }),
  ativoBase('MON-001', 'Monitor LG UltraWide 29"', 'Monitor', 'TI', 'admin@empresa.com', {
    marca: 'LG',
    modelo: '29WK600',
    valorAquisicao: 1290,
    dataAquisicao: '10/01/2025',
    proximaManutencao: '15/11/2026',
  }),
  ativoBase('MON-002', 'Monitor Samsung 24" FHD', 'Monitor', 'Administrativo', 'gerente@empresa.com', {
    marca: 'Samsung',
    modelo: 'LF24T350',
    valorAquisicao: 890,
    dataAquisicao: '22/04/2025',
    status: 'Inativo',
  }),
  ativoBase('CPU-001', 'Desktop CPU Intel i5 12ª Geração', 'CPU/Computador', 'Operacional', 'tecnico@empresa.com', {
    marca: 'Intel',
    modelo: 'i5-12400',
    serial: 'CPU-12-8871',
    valorAquisicao: 3750,
    dataAquisicao: '05/11/2024',
    status: 'Manutenção',
    notas: 'Travamentos intermitentes relatados pelo setor Operacional.',
    proximaManutencao: '10/10/2026',
  }),
  ativoBase('TEC-001', 'Teclado Mecânico Redragon Kumara', 'Teclado', 'TI', 'tecnico@empresa.com', {
    marca: 'Redragon',
    valorAquisicao: 250,
    dataAquisicao: '18/06/2025',
  }),
  ativoBase('MOU-001', 'Mouse Logitech MX Master 3S', 'Mouse', 'Diretoria', 'admin@empresa.com', {
    marca: 'Logitech',
    valorAquisicao: 520,
    dataAquisicao: '18/06/2025',
  }),
  ativoBase('WEB-001', 'Webcam Logitech C920 HD', 'Webcam', 'Vendas', 'gerente@empresa.com', {
    marca: 'Logitech',
    valorAquisicao: 480,
    dataAquisicao: '03/02/2025',
    proximaManutencao: '02/12/2026',
  }),
  ativoBase('IMP-001', 'Impressora HP LaserJet M404', 'Impressora', 'Administrativo', 'admin@empresa.com', {
    marca: 'HP',
    serial: 'HPM404-1290',
    valorAquisicao: 2100,
    dataAquisicao: '27/09/2024',
    status: 'Descartado',
    notas: 'Descartada após falha recorrente na fusora.',
  }),
  ativoBase('ROT-001', 'Roteador Cisco RV340', 'Roteador', 'TI', 'admin@empresa.com', {
    marca: 'Cisco',
    serial: 'CSC-RV340-71',
    valorAquisicao: 1780,
    dataAquisicao: '14/08/2024',
    proximaManutencao: '30/09/2026',
  }),
]

const ESTOQUE: ItemEstoque[] = [
  {
    codigo: 'Item-001',
    descricao: 'Cabo de rede CAT6 3m',
    categoria: 'Cables',
    quantidade: 45,
    quantidadeMinima: 20,
    unidade: 'Peça',
    fornecedor: 'Chipart Informática',
    precoUnitario: 12.9,
  },
  {
    codigo: 'Item-002',
    descricao: 'Mouse USB óptico',
    categoria: 'Periféricos',
    quantidade: 12,
    quantidadeMinima: 15,
    unidade: 'Peça',
    fornecedor: 'Digital Store LTDA',
    precoUnitario: 39.9,
  },
  {
    codigo: 'Item-003',
    descricao: 'Toner HP CF259A',
    categoria: 'Consumíveis',
    quantidade: 4,
    quantidadeMinima: 5,
    unidade: 'Peça',
    fornecedor: 'Positivo Tech',
    precoUnitario: 429,
  },
  {
    codigo: 'Item-004',
    descricao: 'Memória DDR4 8GB 3200MHz',
    categoria: 'Memória',
    quantidade: 0,
    quantidadeMinima: 4,
    unidade: 'Peça',
    fornecedor: 'Kabum! Corporativo',
    precoUnitario: 189,
  },
  {
    codigo: 'Item-005',
    descricao: 'SSD 480GB SATA',
    categoria: 'Armazenamento',
    quantidade: 9,
    quantidadeMinima: 5,
    unidade: 'Peça',
    fornecedor: 'Dell Brasil',
    precoUnitario: 279.9,
  },
  {
    codigo: 'Item-006',
    descricao: 'Fonte notebook Dell 65W',
    categoria: 'Acessórios',
    quantidade: 7,
    quantidadeMinima: 3,
    unidade: 'Peça',
    fornecedor: 'Dell Brasil',
    precoUnitario: 199,
  },
]

const ENTRADAS: Entrada[] = [
  {
    id: 'EDD-2026-000001',
    data: '12/08/2026',
    codigoItem: 'Item-001',
    quantidade: 50,
    precoUnitario: 12.9,
    fornecedor: 'Chipart Informática',
    tipo: 'Compra',
    nf: 'NF-88213',
    usuario: 'admin@empresa.com',
  },
  {
    id: 'EDD-2026-000002',
    data: '05/09/2026',
    codigoItem: 'Item-002',
    quantidade: 20,
    precoUnitario: 39.9,
    fornecedor: 'Digital Store LTDA',
    tipo: 'Compra',
    nf: 'NF-90112',
    usuario: 'tecnico@empresa.com',
  },
]

const SAIDAS: Saida[] = [
  {
    id: 'SAD-2026-000001',
    data: '20/09/2026',
    codigoItem: 'Item-002',
    quantidade: 8,
    tipo: 'Fornecimento',
    responsavel: 'gerente@empresa.com',
    motivo: 'Setup de novas estações',
    usuario: 'tecnico@empresa.com',
  },
  {
    id: 'SAD-2026-000002',
    data: '22/09/2026',
    codigoItem: 'Item-003',
    quantidade: 2,
    tipo: 'Fornecimento',
    responsavel: 'admin@empresa.com',
    motivo: 'Reposição impressora administrativo',
    usuario: 'tecnico@empresa.com',
  },
]

const SOLICITACOES: Solicitacao[] = [
  {
    id: 'SOL-2026-000001',
    data: '18/09/2026',
    solicitante: 'gerente@empresa.com',
    tipo: 'Novo Ativo',
    descricao: 'Notebook extra para estação de trabalho do setor de Vendas.',
    prioridade: 'Alta',
    status: 'Aprovada',
    aprovador: 'admin@empresa.com',
    dataAprovacao: '19/09/2026',
    notasInternas: 'Aguardando compra junto ao fornecedor Dell.',
    criadoEm: '2026-09-18T13:00:00.000Z',
    atualizadoEm: '2026-09-19T10:00:00.000Z',
  },
  {
    id: 'SOL-2026-000002',
    data: '23/09/2026',
    solicitante: 'tecnico@empresa.com',
    tipo: 'Consumível',
    descricao: 'Reposição de toners — estoque abaixo do mínimo.',
    prioridade: 'Normal',
    status: 'Enviada',
    aprovador: 'gerente@empresa.com',
    criadoEm: '2026-09-23T09:30:00.000Z',
    atualizadoEm: '2026-09-23T09:30:00.000Z',
  },
  {
    id: 'SOL-2026-000003',
    data: '25/09/2026',
    solicitante: 'gerente@empresa.com',
    tipo: 'Substituição',
    descricao: 'Substituir monitor danificado do setor Administrativo.',
    prioridade: 'Baixa',
    status: 'Rascunho',
    aprovador: 'admin@empresa.com',
    criadoEm: '2026-09-25T15:00:00.000Z',
    atualizadoEm: '2026-09-25T15:00:00.000Z',
  },
  {
    id: 'SOL-2026-000004',
    data: '10/09/2026',
    solicitante: 'gerente@empresa.com',
    tipo: 'Reparo',
    descricao: 'Reparo em nobreak do servidor (fora de garantia).',
    prioridade: 'Normal',
    status: 'Rejeitada',
    aprovador: 'admin@empresa.com',
    dataAprovacao: '11/09/2026',
    motivoRejeicao: 'Custo de reparo superior ao valor de um equipamento novo.',
    criadoEm: '2026-09-10T11:00:00.000Z',
    atualizadoEm: '2026-09-11T08:00:00.000Z',
  },
]

const MANUTENCOES: Manutencao[] = [
  {
    id: 'MAN-2026-000001',
    codigoAtivo: 'CPU-001',
    tipo: 'Corretiva',
    dataAgendada: '02/10/2026',
    tecnico: 'tecnico@empresa.com',
    status: 'Agendada',
    descricao: 'Diagnosticar travamentos e verificar memória/HD.',
    criadoEm: '2026-09-24T13:00:00.000Z',
    atualizadoEm: '2026-09-24T13:00:00.000Z',
  },
  {
    id: 'MAN-2026-000002',
    codigoAtivo: 'NOTE-001',
    tipo: 'Preventiva',
    dataAgendada: '05/12/2026',
    tecnico: 'tecnico@empresa.com',
    status: 'Agendada',
    descricao: 'Limpeza interna, troca de pasta térmica e atualização de BIOS.',
    proximaData: '05/03/2027',
    criadoEm: '2026-09-06T13:00:00.000Z',
    atualizadoEm: '2026-09-06T13:00:00.000Z',
  },
  {
    id: 'MAN-2026-000003',
    codigoAtivo: 'NOTE-002',
    tipo: 'Preventiva',
    dataAgendada: '21/07/2026',
    dataRealizada: '21/07/2026',
    tecnico: 'tecnico@empresa.com',
    status: 'Concluída',
    descricao: 'Limpeza e verificação de bateria.',
    resultado: 'OK',
    custo: 0,
    proximaData: '20/10/2026',
    criadoEm: '2026-07-15T13:00:00.000Z',
    atualizadoEm: '2026-07-21T17:00:00.000Z',
  },
]

const CONTAGENS: Contagem[] = [
  {
    id: 'INV-2026-000001',
    nome: 'Contagem cíclica — periféricos',
    data: '25/09/2026',
    status: 'Em andamento',
    responsavel: 'tecnico@empresa.com',
    itens: [
      { codigoItem: 'Item-001', contado: 45, contadoEm: '2026-09-25T13:10:00.000Z' },
      { codigoItem: 'Item-002', contado: 10, contadoEm: '2026-09-25T13:12:00.000Z' },
      { codigoItem: 'Item-003', contado: null },
      { codigoItem: 'Item-005', contado: null },
    ],
    ajustesGerados: 0,
    criadoEm: '2026-09-25T13:00:00.000Z',
  },
]

const MOVIMENTACOES: Movimentacao[] = [
  {
    id: 'MOV-2026-000001',
    codigoAtivo: 'CPU-001',
    setorOrigem: 'Operacional',
    setorDestino: 'TI',
    responsavelDestino: 'tecnico@empresa.com',
    status: 'Pendente',
    criadoEm: '2026-09-28T14:00:00.000Z',
    criadoPor: 'gerente@empresa.com',
  },
]

const EMPRESTIMOS: Emprestimo[] = [
  {
    id: 'EMP-2026-000001',
    codigoAtivo: 'MON-001',
    funcionario: 'Mariana Costa',
    matricula: '1042',
    setor: 'Vendas',
    dataEmprestimo: somarDiasBR(hojeBR(), -3),
    previsaoDevolucao: somarDiasBR(hojeBR(), 4),
    observacaoEmprestimo: 'Home office por 1 semana.',
    status: 'Em aberto',
    registradoPor: 'gerente@empresa.com',
    criadoEm: '2026-10-02T13:00:00.000Z',
    atualizadoEm: '2026-10-02T13:00:00.000Z',
  },
  {
    id: 'EMP-2026-000002',
    codigoAtivo: 'MOU-001',
    funcionario: 'Rafael Lima',
    matricula: '1187',
    setor: 'Diretoria',
    dataEmprestimo: somarDiasBR(hojeBR(), -21),
    previsaoDevolucao: somarDiasBR(hojeBR(), -2),
    status: 'Em aberto',
    registradoPor: 'admin@empresa.com',
    criadoEm: '2026-09-14T13:00:00.000Z',
    atualizadoEm: '2026-09-14T13:00:00.000Z',
  },
  {
    id: 'EMP-2026-000003',
    codigoAtivo: 'WEB-001',
    funcionario: 'Juliana Prado',
    matricula: '0983',
    setor: 'Recursos Humanos',
    dataEmprestimo: somarDiasBR(hojeBR(), -40),
    previsaoDevolucao: somarDiasBR(hojeBR(), -33),
    dataDevolucao: somarDiasBR(hojeBR(), -34),
    observacaoDevolucao: 'Devolvida sem avarias, com cabo original.',
    status: 'Devolvido',
    registradoPor: 'gerente@empresa.com',
    devolvidoPor: 'gerente@empresa.com',
    criadoEm: '2026-08-26T13:00:00.000Z',
    atualizadoEm: '2026-09-01T13:00:00.000Z',
  },
]

export function aplicarSeed(): void {
  if (localStorage.getItem('ITSTOCK_SEEDED') === 'true') return
  gravarColecao<Usuario>('USUARIOS', USUARIOS)
  ATIVOS.forEach((a, i) => {
    if (!a.tombamento) a.tombamento = `TOM-${String(i + 1).padStart(6, '0')}`
  })

  gravarColecao<Ativo>('ATIVOS', ATIVOS)
  gravarColecao<ItemEstoque>('ESTOQUE', ESTOQUE)
  gravarColecao<Entrada>('ENTRADAS', ENTRADAS)
  gravarColecao<Saida>('SAIDAS', SAIDAS)
  gravarColecao<Solicitacao>('SOLICITACOES', SOLICITACOES)
  gravarColecao<Manutencao>('MANUTENCOES', MANUTENCOES)
  gravarColecao<Contagem>('CONTAGENS', CONTAGENS)
  gravarColecao<Fornecedor>(
    'FORNECEDORES',
    FORNECEDORES.map((nome, i) => ({
      id: `FOR-2026-${String(i + 1).padStart(6, '0')}`,
      nome,
      cnpj: '',
      ativo: true,
    })),
  )
  gravarColecao<Movimentacao>('MOVIMENTACOES', MOVIMENTACOES)
  gravarColecao<Emprestimo>('EMPRESTIMOS', EMPRESTIMOS)

  localStorage.setItem('ITSTOCK_SEQ_LOG', '0')
  localStorage.setItem('ITSTOCK_SEQ_SOL', '4')
  localStorage.setItem('ITSTOCK_SEQ_MAN', '3')
  localStorage.setItem('ITSTOCK_SEQ_EDD', '2')
  localStorage.setItem('ITSTOCK_SEQ_SAD', '2')
  localStorage.setItem('ITSTOCK_SEQ_INV', '1')
  localStorage.setItem('ITSTOCK_SEQ_FOR', '5')
  localStorage.setItem('ITSTOCK_SEQ_MOV', '1')
  localStorage.setItem('ITSTOCK_SEQ_EMP', '3')
  localStorage.setItem('ITSTOCK_SEQ_SET', '0')
  localStorage.setItem('ITSTOCK_SEEDED', 'true')
}
