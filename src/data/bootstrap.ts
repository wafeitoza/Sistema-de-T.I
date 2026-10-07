import { useUiStore } from '../store/ui'
import { carregarTudo } from './api'
import { sessaoAtual } from './auth'
import { modoSupabase } from './client'
import { carregarSequencia, gravarEspelho, prepararBlocos } from './repository'
import { aplicarSeed } from './seed'

/**
 * Precisa terminar ANTES de os stores serem criados (eles leem o espelho na
 * inicialização). Por isso o `main.tsx` só importa o `App` depois daqui.
 *
 * - modo local: seed de demonstração, como sempre foi.
 * - modo Supabase: baixa as tabelas + sequências e reserva os blocos de ID.
 *   Sem seed — o banco começa zerado (só usuários vieram pela migration).
 *
 * Fase D: com o RLS por perfil, o papel `anon` não lê nenhuma tabela. Baixar
 * dados sem sessão geraria 14 erros de permissão, então o download só acontece
 * com a sessão já restaurada — e, quando o usuário entra pela primeira vez
 * neste navegador, `baixarDados()` roda de novo logo após o login.
 */
export async function iniciar(): Promise<void> {
  if (!modoSupabase) {
    aplicarSeed()
    return
  }

  const sessao = await sessaoAtual().catch(() => null)
  if (!sessao) return

  await baixarDados()
}

/**
 * Baixa as 14 coleções + sequências para o espelho e re-sincroniza os stores
 * (necessário quando isso acontece depois do App já estar montado).
 * Devolve `false` se alguma coleção falhou.
 */
export async function baixarDados(): Promise<boolean> {
  if (!modoSupabase) return true

  try {
    const { colecoes, sequencias, falhas } = await carregarTudo()
    for (const [colecao, dados] of Object.entries(colecoes)) {
      gravarEspelho(colecao, dados)
    }
    for (const [nome, valor] of Object.entries(sequencias)) {
      carregarSequencia(nome, valor)
    }
    await prepararBlocos()

    // Os stores podem já ter sido criados com o espelho vazio (primeiro login
    // neste navegador): import dinâmico para não inicializá-los cedo no boot.
    const { recarregarTodasAsLojas } = await import('../store/recarregar')
    recarregarTodasAsLojas()

    if (falhas.length) {
      avisar(`Falha ao carregar do servidor: ${falhas.join(' · ')}`)
      return false
    }
    return true
  } catch (erro) {
    console.error('[supabase] boot falhou:', erro)
    avisar('Não foi possível carregar os dados do servidor')
    return false
  }
}

function avisar(mensagem: string): void {
  try {
    useUiStore.getState().notificar('erro', mensagem)
  } catch {
    console.error(mensagem)
  }
}
