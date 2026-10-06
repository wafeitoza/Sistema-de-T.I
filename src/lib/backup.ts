import { gravarColecao, lerColecao, limparTudo } from '../data/repository'
import { aplicarSeed } from '../data/seed'
import { agoraISO } from './format'

export const COLECOES_BACKUP = [
  'USUARIOS',
  'ATIVOS',
  'ESTOQUE',
  'ENTRADAS',
  'SAIDAS',
  'SOLICITACOES',
  'MANUTENCOES',
  'CONTAGENS',
  'LOG',
  'TERMOS',
  'SETORES',
  'FORNECEDORES',
  'MOVIMENTACOES',
  'EMPRESTIMOS',
] as const

const SEQUENCIAS_BACKUP = ['EDD', 'INV', 'LOG', 'MAN', 'SAD', 'SOL', 'TERM', 'SET', 'FOR', 'MOV', 'EMP'] as const

const COLECOES_ESSENCIAIS = ['USUARIOS', 'ATIVOS', 'ESTOQUE']

export interface Backup {
  versao: 1
  geradoEm: string
  colecoes: Record<string, unknown[]>
  sequencias: Record<string, number>
}

export function gerarBackup(): Backup {
  const colecoes: Record<string, unknown[]> = {}
  for (const nome of COLECOES_BACKUP) {
    colecoes[nome] = lerColecao<unknown>(nome)
  }
  const sequencias: Record<string, number> = {}
  for (const seq of SEQUENCIAS_BACKUP) {
    sequencias[seq] =
      Number.parseInt(localStorage.getItem(`ITSTOCK_SEQ_${seq}`) ?? '0', 10) || 0
  }
  return { versao: 1, geradoEm: agoraISO(), colecoes, sequencias }
}

export function baixarBackup(backup: Backup): void {
  const conteudo = JSON.stringify(backup, null, 2)
  const blob = new Blob([conteudo], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `it-stock-backup-${backup.geradoEm.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type ResultadoValidacao =
  | { ok: true; backup: Backup; resumo: { nome: string; qtd: number }[] }
  | { ok: false; erro: string }

export function validarBackup(bruto: string): ResultadoValidacao {
  let dados: unknown
  try {
    dados = JSON.parse(bruto)
  } catch {
    return { ok: false, erro: 'Arquivo inválido: não é um JSON válido.' }
  }
  if (!dados || typeof dados !== 'object') {
    return { ok: false, erro: 'Arquivo inválido: estrutura não reconhecida.' }
  }
  const obj = dados as Partial<Backup>
  if (obj.versao !== 1) {
    return { ok: false, erro: 'Versão de backup não reconhecida.' }
  }
  if (!obj.colecoes || typeof obj.colecoes !== 'object') {
    return { ok: false, erro: 'Backup sem coleções de dados.' }
  }
  for (const essencial of COLECOES_ESSENCIAIS) {
    const valor = obj.colecoes[essencial]
    if (!Array.isArray(valor)) {
      return { ok: false, erro: `Backup sem a coleção essencial "${essencial}".` }
    }
  }
  for (const [nome, valor] of Object.entries(obj.colecoes)) {
    if (!Array.isArray(valor)) {
      return { ok: false, erro: `Coleção "${nome}" inválida (esperada uma lista).` }
    }
  }
  const resumo = COLECOES_BACKUP.map((nome) => ({
    nome,
    qtd: Array.isArray(obj.colecoes?.[nome]) ? obj.colecoes[nome].length : 0,
  }))
  return {
    ok: true,
    backup: { versao: 1, geradoEm: obj.geradoEm ?? agoraISO(), colecoes: obj.colecoes, sequencias: obj.sequencias ?? {} },
    resumo,
  }
}

export function aplicarBackup(backup: Backup): void {
  for (const nome of COLECOES_BACKUP) {
    const dados = backup.colecoes[nome]
    gravarColecao(nome, Array.isArray(dados) ? dados : [])
  }
  for (const seq of SEQUENCIAS_BACKUP) {
    localStorage.setItem(
      `ITSTOCK_SEQ_${seq}`,
      String(backup.sequencias?.[seq] ?? 0),
    )
  }
  localStorage.setItem('ITSTOCK_SEEDED', 'true')
}

export function restaurarDemo(): void {
  limparTudo()
  aplicarSeed()
}
