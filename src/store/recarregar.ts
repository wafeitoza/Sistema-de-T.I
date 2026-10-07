import { useAtivosStore } from './ativos'
import { useEmprestimosStore } from './emprestimos'
import { useEstoqueStore } from './estoque'
import { useFornecedoresStore } from './fornecedores'
import { useInventarioStore } from './inventario'
import { useManutencoesStore } from './manutencao'
import { useMovimentacoesStore } from './movimentacoes'
import { useSetoresStore } from './setores'
import { useSolicitacoesStore } from './solicitacoes'
import { useTermosStore } from './termos'

/**
 * Re-lê todas as coleções depois que o espelho é regravado pelo servidor.
 *
 * Existe para o caso de o download acontecer DEPOIS do App já estar montado —
 * o primeiro login deste navegador (o boot pula o download sem sessão, porque
 * com o RLS da Fase D o papel `anon` não lê nenhuma tabela). Nesse momento os
 * stores já foram criados com o espelho vazio e precisam ser atualizados.
 *
 * Importado dinamicamente por `data/bootstrap.ts` para não inicializar os
 * stores antes do espelho estar gravado.
 */
export function recarregarTodasAsLojas(): void {
  useAtivosStore.getState().recarregar()
  useEstoqueStore.getState().recarregar()
  useInventarioStore.getState().recarregar()
  useManutencoesStore.getState().recarregar()
  useTermosStore.getState().recarregar()
  useSolicitacoesStore.getState().recarregar()
  useEmprestimosStore.getState().recarregar()
  useFornecedoresStore.getState().recarregar()
  useMovimentacoesStore.getState().recarregar()
  useSetoresStore.getState().recarregar()
}
