export type Perfil = 'Admin' | 'Gerente' | 'Técnico' | 'Visualizador'

export interface Usuario {
  email: string
  nome: string
  perfil: Perfil
  setor: string
  status: 'Ativo' | 'Inativo'
  telefone?: string
  foto?: string
}

export type StatusAtivo = 'Ativo' | 'Inativo' | 'Manutenção' | 'Descartado'

export interface Ativo {
  codigo: string
  descricao: string
  tipo: string
  marca?: string
  modelo?: string
  configuracao?: string
  serial?: string
  tombamento?: string
  setor: string
  responsavel: string
  status: StatusAtivo
  dataAquisicao: string
  valorAquisicao?: number
  localizacao?: string
  qrUrl: string
  ultimaManutencao?: string
  proximaManutencao?: string
  notas?: string
  criadoEm: string
  atualizadoEm: string
}

export interface Setor {
  id: string
  nome: string
  responsavel: string
  localizacao: string
  ativo: boolean
}

export interface Fornecedor {
  id: string
  nome: string
  cnpj: string
  email?: string
  telefone?: string
  ativo: boolean
}

export type StatusMovimentacao = 'Pendente' | 'Confirmada' | 'Cancelada'

export interface Movimentacao {
  id: string
  codigoAtivo: string
  setorOrigem: string
  setorDestino: string
  responsavelDestino: string
  status: StatusMovimentacao
  criadoEm: string
  criadoPor: string
  confirmadoEm?: string
  confirmadoPor?: string
  canceladoEm?: string
  canceladoPor?: string
}

export type StatusEmprestimo = 'Em aberto' | 'Devolvido' | 'Cancelado'

export interface Emprestimo {
  id: string
  codigoAtivo: string
  funcionario: string
  matricula?: string
  setor: string
  dataEmprestimo: string
  previsaoDevolucao: string
  dataDevolucao?: string
  observacaoEmprestimo?: string
  observacaoDevolucao?: string
  status: StatusEmprestimo
  registradoPor: string
  devolvidoPor?: string
  canceladoPor?: string
  criadoEm: string
  atualizadoEm: string
}

export type StatusEstoque = 'Normal' | 'Baixo' | 'Zerado'

export interface ItemEstoque {
  codigo: string
  descricao: string
  categoria: string
  quantidade: number
  quantidadeMinima: number
  unidade: string
  fornecedor?: string
  precoUnitario?: number
  notas?: string
}

export type TipoEntrada = 'Compra' | 'Devolução' | 'Ajuste' | 'Doação'

export interface Entrada {
  id: string
  data: string
  codigoItem: string
  quantidade: number
  precoUnitario?: number
  fornecedor?: string
  tipo: TipoEntrada
  nf?: string
  usuario: string
  notas?: string
}

export type TipoSaida = 'Fornecimento' | 'Destruição' | 'Empréstimo' | 'Devolução' | 'Ajuste'

export interface Saida {
  id: string
  data: string
  codigoItem: string
  quantidade: number
  tipo: TipoSaida
  responsavel: string
  motivo?: string
  usuario: string
  observacoes?: string
}

export type StatusContagem = 'Em andamento' | 'Concluída'

export interface ItemContagem {
  codigoItem: string
  contado: number | null
  contadoEm?: string
}

export interface Contagem {
  id: string
  nome: string
  data: string
  status: StatusContagem
  responsavel: string
  itens: ItemContagem[]
  concluidaEm?: string
  ajustesGerados: number
  criadoEm: string
}

export type StatusSolicitacao =
  | 'Rascunho'
  | 'Enviada'
  | 'Aprovada'
  | 'Rejeitada'
  | 'Finalizada'

export type TipoSolicitacao =
  | 'Novo Ativo'
  | 'Substituição'
  | 'Reparo'
  | 'Consumível'
  | 'Manutenção'
  | 'Outro'

export type Prioridade = 'Alta' | 'Normal' | 'Baixa'

export interface Solicitacao {
  id: string
  data: string
  solicitante: string
  tipo: TipoSolicitacao
  descricao: string
  prioridade: Prioridade
  status: StatusSolicitacao
  aprovador: string
  /** RN004 (Fase D): UUID aleatório do link de aprovação — só no banco. */
  aprovacaoToken?: string
  tokenExpiraEm?: string
  dataAprovacao?: string
  motivoRejeicao?: string
  dataFinalizacao?: string
  notasInternas?: string
  criadoEm: string
  atualizadoEm: string
}

export type StatusManutencao = 'Agendada' | 'Em Execução' | 'Concluída' | 'Cancelada'
export type TipoManutencao = 'Preventiva' | 'Corretiva' | 'Inspeção'

export interface Manutencao {
  id: string
  codigoAtivo: string
  tipo: TipoManutencao
  dataAgendada: string
  dataRealizada?: string
  tecnico: string
  status: StatusManutencao
  descricao: string
  resultado?: string
  proximaData?: string
  custo?: number
  criadoEm: string
  atualizadoEm: string
}

export type StatusTermo = 'Pendente' | 'Assinado' | 'Revogado'

export interface Termo {
  id: string
  ativoCodigo: string
  responsavel: string
  conteudo: string
  hash: string
  status: StatusTermo
  criadoEm: string
  criadoPor: string
  assinadoEm?: string
  assinadoPor?: string
  revogadoEm?: string
  revogadoPor?: string
}

export type AcaoLog =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'IMPORT'
  | 'EXPORT'
  | 'RESET'

export interface CampoDiff {
  campo: string
  antes: unknown
  depois: unknown
}

export interface LogEntrada {
  id: string
  dataHora: string
  usuario: string
  acao: AcaoLog
  tabela: string
  registroId: string
  campos: CampoDiff[]
  resultado: 'Sucesso' | 'Erro'
  mensagem?: string
}
