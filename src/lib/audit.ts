import { lerColecao, gravarColecao, proximaSequencia } from '../data/repository'
import { agoraISO, formatarData } from './format'
import type { AcaoLog, CampoDiff, LogEntrada } from '../types'

export const COLECAO_LOG = 'LOG'

export function registrarLog(entrada: {
  usuario: string
  acao: AcaoLog
  tabela: string
  registroId: string
  campos?: CampoDiff[]
  resultado?: 'Sucesso' | 'Erro'
  mensagem?: string
}): LogEntrada {
  const logs = lerColecao<LogEntrada>(COLECAO_LOG)
  const log: LogEntrada = {
    id: `LOG-${new Date().getFullYear()}-${String(proximaSequencia('LOG')).padStart(6, '0')}`,
    dataHora: agoraISO(),
    usuario: entrada.usuario,
    acao: entrada.acao,
    tabela: entrada.tabela,
    registroId: entrada.registroId,
    campos: entrada.campos ?? [],
    resultado: entrada.resultado ?? 'Sucesso',
    mensagem: entrada.mensagem,
  }
  logs.unshift(log)
  gravarColecao(COLECAO_LOG, logs.slice(0, 500))
  return log
}

export function calcularDiff(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): CampoDiff[] {
  const campos: CampoDiff[] = []
  for (const chave of Object.keys(depois)) {
    const a = antes[chave]
    const d = depois[chave]
    if (JSON.stringify(a) !== JSON.stringify(d)) {
      campos.push({ campo: chave, antes: a ?? null, depois: d ?? null })
    }
  }
  return campos
}

export function descreverDiff(campo: CampoDiff): string {
  const fmt = (v: unknown) => {
    if (v === null || v === undefined || v === '') return '—'
    if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v
    return String(v)
  }
  return `${campo.campo}: ${fmt(campo.antes)} → ${fmt(campo.depois)}`
}

export function resumoData(iso: string): string {
  return formatarData(iso)
}
