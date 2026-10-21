export type Tom = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'

export const TONS: Record<Tom, string> = {
  success: 'bg-success/15 text-success-text',
  warning: 'bg-warning/15 text-warning-text',
  danger: 'bg-danger/15 text-danger-text',
  info: 'bg-info/15 text-info-text',
  primary: 'bg-primary/15 text-primary',
  neutral: 'bg-surface-3 text-content-muted',
}

const MAPA_STATUS: Record<string, Tom> = {
  Ativo: 'success',
  Inativo: 'neutral',
  Manutenção: 'warning',
  Descartado: 'danger',
  Normal: 'success',
  Baixo: 'warning',
  Zerado: 'danger',
  Rascunho: 'neutral',
  Enviada: 'info',
  Aprovada: 'success',
  Rejeitada: 'danger',
  Finalizada: 'primary',
  Agendada: 'info',
  'Em Execução': 'warning',
  Concluída: 'success',
  Cancelada: 'neutral',
  Pendente: 'warning',
  Confirmada: 'success',
  'Em andamento': 'info',
  'Em aberto': 'info',
  Devolvido: 'success',
  Cancelado: 'neutral',
  Atrasado: 'danger',
  // chamados: 'Aberto' é o que ninguém olhou ainda, por isso vermelho
  Aberto: 'danger',
  'Em atendimento': 'info',
  'Aguardando usuário': 'warning',
  Resolvido: 'success',
}

export function tomDoStatus(status: string): Tom {
  return MAPA_STATUS[status] ?? 'neutral'
}

/** Mesma escala da fila: crítica em vermelho, baixa em cinza. */
export function tomPrioridade(prioridade: string): Tom {
  if (prioridade === 'Crítica') return 'danger'
  if (prioridade === 'Alta') return 'warning'
  if (prioridade === 'Média') return 'info'
  return 'neutral'
}
