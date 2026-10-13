import { sessaoAtual } from './auth'
import { baixarDados } from './bootstrap'
import { modoSupabase } from './client'

/**
 * Item 7 da Fase B: recarregar os dados do servidor quando o usuário volta
 * para a aba (duas pessoas mexendo ao mesmo tempo ficavam com a tela velha
 * até dar F5).
 *
 * Duas proteções, porque o plano free do Supabase cobra cada chamada:
 * - no máximo um download a cada INTERVALO_RECARREGA_MS (uma alternância
 *   rápida de aba não pode virar duas requisições);
 * - nada roda sem sessão — com o RLS da Fase D o papel `anon` não lê
 *   nenhuma tabela, então um download sem sessão só geraria 401.
 */
export const INTERVALO_RECARREGA_MS = 30_000

let ultimaRecarga = 0
let recargaEmAndamento = false

/**
 * Baixa as coleções do servidor e re-lê os stores (`baixarDados`). Devolve
 * `false` quando a chamada foi ignorada (sem sessão, recarga anterior ainda
 * rodando ou dentro do intervalo mínimo).
 */
export async function recarregarAoVoltar(): Promise<boolean> {
  if (recargaEmAndamento) return false
  if (Date.now() - ultimaRecarga < INTERVALO_RECARREGA_MS) return false
  if (!(await sessaoAtual().catch(() => null))) return false

  recargaEmAndamento = true
  // conta como recarga mesmo tendo falhado: offline não pode virar
  // uma tentativa por segundo ao voltar a aba
  ultimaRecarga = Date.now()
  try {
    return await baixarDados()
  } catch (erro) {
    console.error('[supabase] falha ao recarregar com o voltar da aba:', erro)
    return false
  } finally {
    recargaEmAndamento = false
  }
}

/**
 * Liga os listeners de aba/foco e devolve a função de desligar.
 * No modo local é no-op: o localStorage não muda em outro navegador.
 */
export function instalarRecargaAoFoco(): () => void {
  if (!modoSupabase) return () => {}

  const aoVoltar = () => {
    if (document.visibilityState === 'visible') void recarregarAoVoltar()
  }
  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('focus', aoVoltar)
  return () => {
    document.removeEventListener('visibilitychange', aoVoltar)
    window.removeEventListener('focus', aoVoltar)
  }
}
