import type { Ativo, Termo } from '../types'
import { hojeBR } from './format'
import { sha256Hex } from './hash'

export function montarPayload(t: Termo): string {
  return JSON.stringify({
    ativoCodigo: t.ativoCodigo,
    responsavel: t.responsavel,
    conteudo: t.conteudo,
    criadoEm: t.criadoEm,
    criadoPor: t.criadoPor,
  })
}

export async function calcularHashTermo(t: Termo): Promise<string> {
  return sha256Hex(montarPayload(t))
}

export async function integridadeOK(t: Termo): Promise<boolean> {
  if (!t.hash) return false
  return (await calcularHashTermo(t)) === t.hash
}

export function conteudoPadrao(ativo: Ativo, responsavel: string): string {
  const modelo = [ativo.marca, ativo.modelo].filter(Boolean).join(' ')
  return [
    'TERMO DE RESPONSABILIDADE PELO ATIVO DE T.I.',
    '',
    `Eu, ${responsavel}, assumo a responsabilidade pelo uso do ativo ${ativo.codigo} — ${ativo.descricao}${modelo ? ` (${modelo})` : ''}, sob minha guarda no setor ${ativo.setor}, comprometendo-me a:`,
    '',
    '1. utilizar o equipamento apenas para finalidades laborais;',
    '2. comunicar imediatamente qualquer dano, extravio ou mau funcionamento;',
    '3. devolver o ativo em caso de transferência, desligamento ou descarte.',
    '',
    `Local: Salvador/BA — Data: ${hojeBR()}`,
  ].join('\n')
}
