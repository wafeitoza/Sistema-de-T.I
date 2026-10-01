import { diasAte, formatarData } from './format'
import type { Contagem, ItemEstoque, Manutencao, Perfil, Solicitacao } from '../types'

export interface Alerta {
  id: string
  titulo: string
  descricao: string
  rota: string
  tom: 'danger' | 'warning' | 'info'
}

const CHAVE_LIDAS = 'ITSTOCK_NOTIFICACOES_LIDAS'

const ORDEM: Record<Alerta['tom'], number> = { danger: 0, warning: 1, info: 2 }

export interface DadosAlertas {
  estoque: ItemEstoque[]
  manutencoes: Manutencao[]
  solicitacoes: Solicitacao[]
  contagens: Contagem[]
}

export function calcularAlertas(
  perfil: Perfil | undefined,
  dados: DadosAlertas,
): Alerta[] {
  const alertas: Alerta[] = []

  for (const item of dados.estoque) {
    if (item.quantidade <= 0) {
      alertas.push({
        id: `estoque:${item.codigo}:${item.quantidade}`,
        titulo: 'Item sem estoque',
        descricao: `${item.descricao} (${item.codigo}) está zerado`,
        rota: '/estoque',
        tom: 'danger',
      })
    } else if (item.quantidade <= item.quantidadeMinima) {
      alertas.push({
        id: `estoque:${item.codigo}:${item.quantidade}`,
        titulo: 'Estoque baixo',
        descricao: `${item.descricao}: ${item.quantidade} ${item.unidade} (mín. ${item.quantidadeMinima})`,
        rota: '/estoque',
        tom: 'warning',
      })
    }
  }

  for (const m of dados.manutencoes) {
    const dias = diasAte(m.dataAgendada)
    if (m.status === 'Agendada' && dias !== null && dias < 0) {
      alertas.push({
        id: `manutencao:${m.id}:vencida`,
        titulo: 'Manutenção vencida',
        descricao: `${m.codigoAtivo} — agendada para ${formatarData(m.dataAgendada)}`,
        rota: '/manutencao',
        tom: 'danger',
      })
    } else if (m.status === 'Em Execução') {
      alertas.push({
        id: `manutencao:${m.id}:execucao`,
        titulo: 'Manutenção em execução',
        descricao: `${m.codigoAtivo} — ${m.tipo.toLowerCase()}`,
        rota: '/manutencao',
        tom: 'info',
      })
    }
  }

  if (perfil === 'Admin' || perfil === 'Gerente') {
    for (const s of dados.solicitacoes) {
      if (s.status === 'Enviada') {
        alertas.push({
          id: `solicitacao:${s.id}:${s.atualizadoEm}`,
          titulo: 'Aprovação pendente',
          descricao: `${s.tipo} — ${s.solicitante} (${formatarData(s.data)})`,
          rota: '/solicitacoes',
          tom: 'warning',
        })
      }
    }
  }

  for (const c of dados.contagens) {
    if (c.status === 'Em andamento') {
      alertas.push({
        id: `contagem:${c.id}:em-andamento`,
        titulo: 'Contagem em andamento',
        descricao: `${c.nome} — iniciada em ${formatarData(c.data)}`,
        rota: '/inventario',
        tom: 'info',
      })
    }
  }

  return alertas.sort((a, b) => ORDEM[a.tom] - ORDEM[b.tom])
}

export function lerLidas(): Record<string, string> {
  try {
    const bruto = localStorage.getItem(CHAVE_LIDAS)
    return bruto ? (JSON.parse(bruto) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function gravarLidas(lidas: Record<string, string>): void {
  localStorage.setItem(CHAVE_LIDAS, JSON.stringify(lidas))
}

export function marcarLida(id: string): void {
  const lidas = lerLidas()
  lidas[id] = new Date().toISOString()
  gravarLidas(lidas)
}

export function marcarTodasLidas(idsAtuais: string[]): void {
  const agora = new Date().toISOString()
  gravarLidas(Object.fromEntries(idsAtuais.map((id) => [id, agora])))
}
