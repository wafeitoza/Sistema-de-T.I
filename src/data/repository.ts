import { NOMES_SEQUENCIA, TAMANHO_BLOCO, proximaSequenciaRemota, sincronizarColecao } from './api'
import { modoSupabase } from './client'
import { useUiStore } from '../store/ui'

const PREFIXO = 'ITSTOCK_'

/** Quando falta esta quantidade no bloco, já busca outro no servidor. */
const PREFETCH = 25

/** Último valor de sequência que este cliente pode usar por nome. */
const blocos = new Map<string, number>()
const reservas = new Map<string, Promise<void>>()

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
  void sincronizarColecao(colecao, antes as never, depois as never).catch((erro) => {
    console.error(`[supabase] falha ao sincronizar ${colecao}:`, erro)
    try {
      useUiStore.getState().notificar('erro', `Falha ao sincronizar ${colecao} com o servidor`)
    } catch {
      // store indisponível (fora do app, ex.: teste unitário)
    }
  })
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

function garanteReserva(nome: string, usado: number): void {
  const limite = blocos.get(nome)
  if (limite === undefined || usado > limite || limite - usado <= PREFETCH) {
    void reservar(nome)
  }
}

function reservar(nome: string, qtd: number = TAMANHO_BLOCO): Promise<void> {
  const pendente = reservas.get(nome)
  if (pendente) return pendente

  const promessa = proximaSequenciaRemota(nome, qtd)
    .then((topo) => {
      const base = topo - qtd // valores base+1..topo ficam com este cliente
      if (base > leiaSEQ(nome)) gravaSEQ(nome, base)
      blocos.set(nome, Math.max(blocos.get(nome) ?? 0, topo))
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
  const limite = blocos.get(nome) ?? 0
  if (necessario <= limite) return
  reservar(nome, necessario - limite + TAMANHO_BLOCO)
}

/**
 * Reserva os blocos iniciais antes do app renderizar: assim o primeiro ID
 * gerado já cai dentro de um bloco exclusivo deste cliente.
 */
export async function prepararBlocos(): Promise<void> {
  await Promise.all(NOMES_SEQUENCIA.map((nome) => reservar(nome)))
}

/** Espelha o valor do servidor no localStorage (chamado no boot). */
export function carregarSequencia(nome: string, valor: number): void {
  if (!Number.isFinite(valor)) return
  const local = leiaSEQ(nome)
  if (valor > local) gravaSEQ(nome, valor)
}

/** Visibilidade do bloco de um nome (útil em teste/debug). */
export function limiteDeSequencia(nome: string): number | undefined {
  return blocos.get(nome)
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
