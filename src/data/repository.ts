import {
  NOMES_SEQUENCIA,
  TAMANHO_BLOCO,
  buscarAuditoria,
  proximaSequenciaRemota,
  sincronizarColecao,
} from './api'
import { estadoSessao, sessaoAtual } from './auth'
import { modoSupabase } from './client'
import { useUiStore } from '../store/ui'

const PREFIXO = 'ITSTOCK_'

/** Quando falta esta quantidade no bloco, já busca outro no servidor. */
const PREFETCH = 25

/**
 * Último valor de sequência que este cliente pode usar por nome.
 *
 * O Map é só cache de escrita: a fonte de verdade é o localStorage, porque o
 * topo do bloco é um direito **deste navegador** e tem que sobreviver ao F5.
 * Antes vivia só no Map — aí cada recarga zerava `blocos`, `blocoInsuficiente()`
 * calculava `0 - leiaSEQ()` (número negativo, sempre "insuficiente") e o boot
 * reservava outro bloco de 100, mesmo sem o cliente precisar de nenhum número.
 * Medido em produção em 15/10/2026: três recargas do E2E levaram `ATV_NOTE`
 * de 800 a 1100 sem criar um único ativo.
 */
const blocos = new Map<string, number>()
const reservas = new Map<string, Promise<void>>()

function leiaBLOCO(nome: string): number {
  const emMemoria = blocos.get(nome)
  if (emMemoria !== undefined) return emMemoria

  const bruto = localStorage.getItem(`${PREFIXO}BLOCO_${nome}`)
  const valor = bruto === null ? 0 : Number(bruto)
  if (!Number.isFinite(valor) || valor <= 0) return 0

  blocos.set(nome, valor)
  return valor
}

function gravaBLOCO(nome: string, valor: number): void {
  blocos.set(nome, valor)
  localStorage.setItem(`${PREFIXO}BLOCO_${nome}`, String(valor))
}

export function lerColecao<T>(colecao: string): T[] {
  try {
    const raw = localStorage.getItem(`${PREFIXO}${colecao}`)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

/**
 * Grava no espelho (localStorage) e, no modo Supabase, envia ao servidor
 * só o que mudou. A assinatura continua síncrona — os 10 stores não mudam.
 */
export function gravarColecao<T>(colecao: string, dados: T[]): void {
  const anterior = lerColecao<T>(colecao)
  gravarEspelho(colecao, dados)
  if (modoSupabase) sincronizar(colecao, anterior, dados)
}

/** Grava só no espelho, sem sincronizar (boot e restauração de backup). */
export function gravarEspelho<T>(colecao: string, dados: T[]): void {
  localStorage.setItem(`${PREFIXO}${colecao}`, JSON.stringify(dados))
}

function sincronizar(colecao: string, antes: unknown[], depois: unknown[]): void {
  void (async () => {
    const estado = await estadoSessao()

    // Fase D: sem sessão o papel da requisição é `anon`, que não alcança
    // nenhuma tabela — tentar sincronizar viraria só 401 + toast de erro no
    // boot anônimo (é o que acontece quando o espelho local está vazio e o
    // store gera o seed padrão, ex.: SETORES). Nada se perde: depois do login
    // `baixarDados()` regrava o espelho com o servidor e a próxima gravação
    // volta a sincronizar normalmente.
    if (estado.estado === 'anonimo') return

    // Sessão "logada, mas cuja verificação falhou" (refresh token expirado/
    // inválido): sem token válido o PostgREST responderia 401, e descartar em
    // silêncio faria o dado sumir do servidor no próximo `baixarDados()` — o
    // avatar que "não salvava" era isto. Em vez de fingir que gravou, avisa
    // para o usuário entrar de novo. (Se o token ainda está dentro da validade
    // real, o supabase-js devolve a sessão guardada e caímos no caminho normal.)
    if (estado.estado === 'falha') {
      console.error('[supabase] sessão indisponível ao sincronizar', colecao, estado.erro)
      try {
        useUiStore
          .getState()
          .notificar('erro', `Sessão expirada — ${colecao} não foi salvo. Entre de novo para sincronizar.`)
      } catch {
        // store indisponível (fora do app, ex.: teste unitário)
      }
      return
    }

    await sincronizarColecao(colecao, antes as never, depois as never)
  })().catch((erro) => {
    console.error(`[supabase] falha ao sincronizar ${colecao}:`, erro)
    try {
      useUiStore.getState().notificar('erro', `Falha ao sincronizar ${colecao} com o servidor`)
    } catch {
      // store indisponível (fora do app, ex.: teste unitário)
    }
  })
}

/**
 * Recarrega o espelho de LOG a partir do servidor. Usado quando o registro de
 * auditoria nasce no banco (decisão por link de aprovação via RPC), já que o
 * navegador não participou da escrita.
 */
export async function recarregarLog(): Promise<void> {
  if (!modoSupabase) return
  try {
    gravarEspelho('LOG', await buscarAuditoria())
  } catch (erro) {
    console.error('[supabase] falha ao recarregar a auditoria:', erro)
  }
}

export function lerItem<T>(colecao: string, chave: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIXO}${colecao}_${chave}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function gravarItem<T>(colecao: string, chave: string, valor: T): void {
  localStorage.setItem(`${PREFIXO}${colecao}_${chave}`, JSON.stringify(valor))
}

function leiaSEQ(nome: string): number {
  return Number.parseInt(localStorage.getItem(`${PREFIXO}SEQ_${nome}`) ?? '0', 10) || 0
}

function gravaSEQ(nome: string, valor: number): void {
  localStorage.setItem(`${PREFIXO}SEQ_${nome}`, String(valor))
}

/**
 * No modo Supabase o valor vem de um bloco reservado no banco (a reserva é
 * atômica, então dois usuários não geram o mesmo ID); no modo local continua
 * incrementando o localStorage como sempre.
 */
export function proximaSequencia(nome: string): number {
  const proximo = leiaSEQ(nome) + 1
  gravaSEQ(nome, proximo)
  if (modoSupabase) garanteReserva(nome, proximo)
  return proximo
}

function blocoInsuficiente(nome: string): boolean {
  return leiaBLOCO(nome) - leiaSEQ(nome) <= PREFETCH
}

function garanteReserva(nome: string, usado: number): void {
  if (usado > leiaBLOCO(nome) || blocoInsuficiente(nome)) {
    void reservar(nome)
  }
}

function reservar(nome: string, qtd: number = TAMANHO_BLOCO): Promise<void> {
  const pendente = reservas.get(nome)
  if (pendente) return pendente

  const promessa = sessaoAtual()
    .then((sessao) => (sessao ? proximaSequenciaRemota(nome, qtd) : null))
    .then((topo) => {
      // Sem sessão não há como reservar no servidor (o `anon` não executa a
      // RPC): o bloco é reservado por `prepararBlocos()` logo após o login.
      if (topo === null) return
      const base = topo - qtd // valores base+1..topo ficam com este cliente
      if (base > leiaSEQ(nome)) gravaSEQ(nome, base)
      gravaBLOCO(nome, Math.max(leiaBLOCO(nome), topo))
    })
    .catch((erro) => {
      console.error(`[supabase] falha ao reservar sequência ${nome}:`, erro)
    })
    .finally(() => reservas.delete(nome))

  reservas.set(nome, promessa)
  return promessa
}

/**
 * Garante bloco suficiente para o valor `necessario` (usado ao restaurar um
 * backup, que pode pular a contagem local para um número bem maior).
 */
export function garantirBloco(nome: string, necessario: number): void {
  if (!modoSupabase) return
  const limite = leiaBLOCO(nome)
  if (necessario <= limite) return
  reservar(nome, necessario - limite + TAMANHO_BLOCO)
}

/**
 * Garante bloco para os nomes que ainda não têm (ou estão quase no fim).
 *
 * Só reserva onde falta: como roda a cada `baixarDados()` (login, foco da
 * aba, F5), reservar sempre queimaria 26 × 50 = 1300 números do servidor
 * por volta de aba — medido em produção em 13/10/2026, quando o E2E viu a
 * sequência de NOTE ir de 0 a 250 e o primeiro ativo sair NOTE-051.
 *
 * A proteção só funcionava dentro da mesma aba: `blocos` vivia no Map, então
 * o F5 zerava o limite e o boot reservava mais 100 por nome sem ninguém
 * pedir (15/10/2026: `ATV_NOTE` foi de 800 a 1100 em três recargas, sem criar
 * ativo). Por isso o topo agora é lido do localStorage — o bloco é direito
 * deste navegador e precisa atravessar o reload.
 */
export async function prepararBlocos(): Promise<void> {
  const faltando = NOMES_SEQUENCIA.filter((nome) => blocoInsuficiente(nome))
  await Promise.all(faltando.map((nome) => reservar(nome)))
}

/**
 * Espelha o valor do servidor no localStorage (chamado no boot).
 *
 * No-op quando este cliente já tem bloco: o topo do servidor pode ser
 * justamente o bloco que reservamos há um instante e ainda não usamos, e
 * pular o contador para lá desperdiçaria o bloco inteiro. Bloco exclusivo
 * é nosso até o fim — mesmo que outro cliente já tenha ido além.
 */
export function carregarSequencia(nome: string, valor: number): void {
  if (!Number.isFinite(valor)) return
  if (leiaBLOCO(nome) > 0) return
  const local = leiaSEQ(nome)
  if (valor > local) gravaSEQ(nome, valor)
}

/** Visibilidade do bloco de um nome (útil em teste/debug). */
export function limiteDeSequencia(nome: string): number | undefined {
  return leiaBLOCO(nome) || undefined
}

export function colecaoExiste(colecao: string): boolean {
  return localStorage.getItem(`${PREFIXO}${colecao}`) !== null
}

export function limparTudo(): void {
  const chaves: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i)
    if (chave?.startsWith(PREFIXO)) chaves.push(chave)
  }
  chaves.forEach((c) => localStorage.removeItem(c))
}
