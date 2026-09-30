import type { Perfil } from '../types'

export const TODOS_PERFIS: Perfil[] = ['Admin', 'Gerente', 'Técnico', 'Visualizador']

const TODOS: Perfil[] = ['Admin', 'Gerente', 'Técnico', 'Visualizador']

export const ACESSO_ROTA: Record<string, Perfil[]> = {
  '/': TODOS,
  '/ativos': TODOS,
  '/estoque': TODOS,
  '/inventario': TODOS,
  '/manutencao': TODOS,
  '/solicitacoes': ['Admin', 'Gerente'],
}

export function podeAcessarRota(rota: string, perfil: Perfil): boolean {
  const permitidos = ACESSO_ROTA[rota] ?? TODOS
  return permitidos.includes(perfil)
}

export function podeEditar(perfil: Perfil): boolean {
  return perfil !== 'Visualizador'
}

export function podeCriarSolicitacao(perfil: Perfil): boolean {
  return perfil === 'Admin' || perfil === 'Gerente'
}

export function podeAprovar(perfil: Perfil): boolean {
  return perfil === 'Admin' || perfil === 'Gerente'
}
