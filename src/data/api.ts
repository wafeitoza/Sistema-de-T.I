import type { ItemContagem } from '../types'
import { cliente, modoSupabase } from './client'

type Linha = Record<string, unknown>

export interface Definicao {
  tabela: string
  chave: string
  /** append = só insere (auditoria é imutável); contagens = acha/desacha itens. */
  modo?: 'padrao' | 'append' | 'contagens'
}

/** Coleção do localStorage → tabela do Postgres (14 no total). */
export const DEFINICOES: Record<string, Definicao> = {
  USUARIOS: { tabela: 'usuarios', chave: 'email' },
  SETORES: { tabela: 'setores', chave: 'id' },
  FORNECEDORES: { tabela: 'fornecedores', chave: 'id' },
  ATIVOS: { tabela: 'ativos', chave: 'codigo' },
  ESTOQUE: { tabela: 'estoque', chave: 'codigo' },
  ENTRADAS: { tabela: 'entradas_estoque', chave: 'id' },
  SAIDAS: { tabela: 'saidas_estoque', chave: 'id' },
  SOLICITACOES: { tabela: 'solicitacoes', chave: 'id' },
  MANUTENCOES: { tabela: 'manutencoes', chave: 'id' },
  CONTAGENS: { tabela: 'contagens', chave: 'id', modo: 'contagens' },
  TERMOS: { tabela: 'termos', chave: 'id' },
  MOVIMENTACOES: { tabela: 'movimentacoes', chave: 'id' },
  EMPRESTIMOS: { tabela: 'emprestimos', chave: 'id' },
  LOG: { tabela: 'auditoria', chave: 'id', modo: 'append' },
}

/** Nomes de sequência usados pelo app (mesma lista do backup). */
export const NOMES_SEQUENCIA = [
  'EDD',
  'EMP',
  'FOR',
  'INV',
  'LOG',
  'MAN',
  'MOV',
  'SAD',
  'SET',
  'SOL',
  'TERM',
] as const

/** Tamanho do bloco reservado por vez (50 IDs por chamada ao servidor). */
export const TAMANHO_BLOCO = 50

/** Colunas `numeric` do Postgres voltam como string ("5490.00"). */
const CAMPOS_NUMERICOS = new Set(['valorAquisicao', 'precoUnitario', 'custo'])

/** null só é significativo onde o tipo do app prevê null. */
const NULL_SIGNIFICATIVO = new Set(['contado'])

const RE_DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/
const RE_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const RE_TEMPO_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function paraChaveBanco(chave: string): string {
  return chave.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function paraChaveApp(chave: string): string {
  return chave.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** `DD/MM/AAAA` → `AAAA-MM-DD` (as datas de negócio do app). */
function valorParaBanco(valor: unknown): unknown {
  if (typeof valor === 'string') {
    const br = RE_DATA_BR.exec(valor)
    if (br) return `${br[3]}-${br[2]}-${br[1]}`
  }
  return valor
}

/** Inverte as conversões acima + normaliza tipos que o PostgREST muda. */
function valorParaApp(chave: string, valor: unknown): unknown {
  if (valor === null || valor === undefined) return undefined
  if (typeof valor !== 'string') return valor

  if (RE_DATA_ISO.test(valor)) {
    const [ano, mes, dia] = valor.split('-')
    return `${dia}/${mes}/${ano}`
  }
  if (RE_TEMPO_ISO.test(valor)) {
    const data = new Date(valor)
    return Number.isNaN(data.getTime()) ? valor : data.toISOString()
  }
  if (CAMPOS_NUMERICOS.has(chave) && /^-?\d+(\.\d+)?$/.test(valor)) return Number(valor)
  return valor
}

/** Objeto do app → registro da tabela (chaves snake_case, datas ISO). */
export function paraBanco(colecao: string, registro: Linha): Linha {
  const saida: Linha = {}
  for (const [chave, valor] of Object.entries(registro)) {
    if (valor === undefined) continue
    if (colecao === 'CONTAGENS' && chave === 'itens') continue
    saida[paraChaveBanco(chave)] = valorParaBanco(valor)
  }
  return saida
}

/** Registro da tabela → objeto do app (chaves camelCase, datas DD/MM/AAAA). */
export function paraApp(colecao: string, linha: Linha): Linha {
  const bruto: Linha = { ...linha }
  let itensBrutos: Linha[] = []
  if (colecao === 'CONTAGENS') {
    itensBrutos = (bruto.contagem_itens as Linha[] | undefined) ?? []
    delete bruto.contagem_itens
  }

  const saida: Linha = {}
  for (const [chave, valor] of Object.entries(bruto)) {
    const chaveApp = paraChaveApp(chave)
    if (valor === null && !NULL_SIGNIFICATIVO.has(chaveApp)) continue
    const convertido = valorParaApp(chaveApp, valor)
    if (convertido !== undefined) saida[chaveApp] = convertido
  }

  if (colecao === 'CONTAGENS') {
    saida.itens = itensBrutos.map((item) => paraItemContagem(item))
  }
  return saida
}

function paraItemContagem(item: Linha): ItemContagem {
  const contado = item.contado
  const resultado: ItemContagem = {
    codigoItem: String(item.codigo_item),
    contado: contado === null || contado === undefined ? null : Number(contado),
  }
  const contadoEm = valorParaApp('contadoEm', item.contado_em)
  if (typeof contadoEm === 'string') resultado.contadoEm = contadoEm
  return resultado
}

/** `Contagem.itens` → linhas de `contagem_itens`. */
export function itensParaBanco(contagem: Linha): Linha[] {
  const itens = (contagem.itens as ItemContagem[] | undefined) ?? []
  return itens.map((item) => {
    const linha: Linha = {
      contagem_id: contagem.id,
      codigo_item: item.codigoItem,
      contado: item.contado ?? null,
    }
    if (item.contadoEm) linha.contado_em = valorParaBanco(item.contadoEm)
    return linha
  })
}

export interface Diferenca {
  mudancas: Linha[]
  removidos: unknown[]
}

/**
 * O que mudou entre o estado anterior e o novo, comparando pela chave primária
 * já convertida (assim `undefined` do app e `null` do banco não geram falso positivo).
 */
export function calcularDiferenca(colecao: string, antes: Linha[], depois: Linha[]): Diferenca {
  const def = DEFINICOES[colecao]
  const anterior = new Map(antes.map((r) => [r[def.chave], r]))
  const atual = new Set(depois.map((r) => r[def.chave]))

  const mudancas = depois.filter((registro) => {
    const previo = anterior.get(registro[def.chave])
    if (!previo) return true
    return (
      JSON.stringify(paraBanco(colecao, previo)) !== JSON.stringify(paraBanco(colecao, registro))
    )
  })

  const removidos = antes.filter((r) => !atual.has(r[def.chave])).map((r) => r[def.chave])
  return { mudancas, removidos }
}

/**
 * Lê todas as tabelas em paralelo. Os arrays voltam no formato do app — quem
 * grava o espelho em localStorage é o bootstrap (para não disparar sync em cascata).
 */
export async function carregarTudo(): Promise<{
  colecoes: Record<string, unknown[]>
  sequencias: Record<string, number>
  falhas: string[]
}> {
  const db = cliente()
  const falhas: string[] = []

  const leituras = await Promise.allSettled(
    Object.entries(DEFINICOES).map(async ([colecao, def]) => {
      let consulta = db
        .from(def.tabela)
        .select(def.modo === 'contagens' ? '*, contagem_itens(*)' : '*')
      if (def.modo === 'append') consulta = consulta.order('data_hora', { ascending: false }).limit(1000)
      const { data, error } = await consulta
      if (error) throw new Error(`${def.tabela}: ${error.message}`)
      // cast via unknown: o parser de tipos do supabase não entende "*, contagem_itens(*)"
      const linhas = (data ?? []) as unknown as Linha[]
      if (linhas.length >= 1000) {
        console.warn(`[supabase] ${def.tabela} retornou ${linhas.length} linhas (possível truncamento)`)
      }
      return [colecao, linhas.map((linha) => paraApp(colecao, linha))] as const
    }),
  )

  const colecoes: Record<string, unknown[]> = {}
  leituras.forEach((resultado, i) => {
    const colecao = Object.keys(DEFINICOES)[i]
    if (resultado.status === 'fulfilled') {
      colecoes[resultado.value[0]] = resultado.value[1]
    } else {
      const motivo = String(resultado.reason?.message ?? resultado.reason)
      falhas.push(`${colecao}: ${motivo}`)
      console.error(`[supabase] falha ao ler ${colecao}:`, resultado.reason)
    }
  })

  let sequencias: Record<string, number> = {}
  try {
    sequencias = await carregarSequencias()
  } catch (erro) {
    falhas.push(`sequencias: ${(erro as Error).message}`)
    console.error('[supabase] falha ao ler sequencias:', erro)
  }

  return { colecoes, sequencias, falhas }
}

async function carregarSequencias(): Promise<Record<string, number>> {
  const { data, error } = await cliente().from('sequencias').select('nome,valor')
  if (error) throw new Error(error.message)
  const saida: Record<string, number> = {}
  for (const linha of ((data ?? []) as unknown as Linha[])) {
    saida[String(linha.nome)] = Number(linha.valor)
  }
  return saida
}

/** Envia ao servidor o que mudou nesta coleção (diff por registro). */
export async function sincronizarColecao(
  colecao: string,
  antes: Linha[],
  depois: Linha[],
): Promise<void> {
  if (!modoSupabase) return
  const def = DEFINICOES[colecao]
  if (!def) return // TEMA, SESSAO, SEQ_*… não são coleções do banco

  const { mudancas, removidos } = calcularDiferenca(colecao, antes, depois)

  if (def.modo === 'append') {
    // auditoria: só entra linha nova (trigger bloqueia UPDATE/DELETE)
    const novos = depois
      .filter((r) => !antes.some((a) => a[def.chave] === r[def.chave]))
      .map((r) => paraBanco(colecao, r))
    if (novos.length) {
      const { error } = await cliente()
        .from(def.tabela)
        .upsert(novos, { onConflict: def.chave, ignoreDuplicates: true })
      if (error) throw new Error(`${def.tabela}: ${error.message}`)
    }
    return
  }

  if (mudancas.length) {
    const registros = mudancas.map((r) => paraBanco(colecao, r))
    const { error } =
      colecao === 'CONTAGENS'
        ? await upsertContagens(mudancas)
        : await cliente().from(def.tabela).upsert(registros)
    if (error) throw new Error(`${def.tabela}: ${error.message}`)
  }

  if (removidos.length) {
    const { error } = await cliente().from(def.tabela).delete().in(def.chave, removidos)
    if (error) throw new Error(`${def.tabela}: ${error.message}`)
  }
}

/** Contagens: upsert da contagem + reescreve os itens (FK em `contagem_itens`). */
async function upsertContagens(mudancas: Linha[]) {
  const db = cliente()
  const registros = mudancas.map((r) => paraBanco('CONTAGENS', r))
  const { error } = await db.from('contagens').upsert(registros)
  if (error) return { error }

  const ids = mudancas.map((r) => r.id as string)
  const { error: erroDelete } = await db.from('contagem_itens').delete().in('contagem_id', ids)
  if (erroDelete) return { error: erroDelete }

  const itens = mudancas.flatMap((r) => itensParaBanco(r))
  if (!itens.length) return { error: null }
  return db.from('contagem_itens').insert(itens)
}

/** Reserva um bloco de sequência no servidor; devolve o topo do bloco. */
export async function proximaSequenciaRemota(nome: string, qtd: number): Promise<number> {
  const { data, error } = await cliente().rpc('reservar_sequencia', {
    p_nome: nome,
    p_qtd: qtd,
  })
  if (error) throw new Error(error.message)
  return Number(data)
}
