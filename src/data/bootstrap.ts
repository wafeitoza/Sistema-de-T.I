import { useUiStore } from '../store/ui'
import { carregarTudo } from './api'
import { modoSupabase } from './client'
import { carregarSequencia, gravarEspelho, prepararBlocos } from './repository'
import { aplicarSeed } from './seed'

/**
 * Precisa terminar ANTES de os stores serem criados (eles leem o espelho na
 * inicialização). Por isso o `main.tsx` só importa o `App` depois daqui.
 *
 * - modo local: seed de demonstração, como sempre foi.
 * - modo Supabase: baixa as 14 tabelas + sequências e reserva os blocos de ID.
 *   Sem seed — o banco começa zerado (só usuários vieram pela migration).
 */
export async function iniciar(): Promise<void> {
  if (!modoSupabase) {
    aplicarSeed()
    return
  }

  try {
    const { colecoes, sequencias, falhas } = await carregarTudo()
    for (const [colecao, dados] of Object.entries(colecoes)) {
      gravarEspelho(colecao, dados)
    }
    for (const [nome, valor] of Object.entries(sequencias)) {
      carregarSequencia(nome, valor)
    }
    await prepararBlocos()

    if (falhas.length) {
      avisar(`Falha ao carregar do servidor: ${falhas.join(' · ')}`)
    }
  } catch (erro) {
    console.error('[supabase] boot falhou:', erro)
    avisar('Não foi possível carregar os dados do servidor')
  }
}

function avisar(mensagem: string): void {
  try {
    useUiStore.getState().notificar('erro', mensagem)
  } catch {
    console.error(mensagem)
  }
}
