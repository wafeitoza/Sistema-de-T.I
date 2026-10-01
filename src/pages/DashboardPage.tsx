import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Box,
  CalendarClock,
  Package,
  Wrench,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { lerColecao } from '../data/repository'
import { BadgeStatus } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Card3D } from '../components/ui/Card3D'
import { Reveal } from '../components/ui/Reveal'
import { diasAte, formatarData } from '../lib/format'
import { podeAcessarRota } from '../lib/permissions'
import { statusEstoque } from '../store/estoque'
import { useAtivosStore } from '../store/ativos'
import { useAuthStore } from '../store/auth'
import { useEstoqueStore } from '../store/estoque'
import { useManutencoesStore } from '../store/manutencao'
import { useSolicitacoesStore } from '../store/solicitacoes'
import type { LogEntrada } from '../types'

const CORES_STATUS: Record<string, string> = {
  Ativo: '#34C759',
  Inativo: '#9CA3AF',
  Manutenção: '#FF9500',
  Descartado: '#FF3B30',
}

function Metrica({
  icone,
  titulo,
  valor,
  detalhe,
  tom,
}: {
  icone: React.ReactNode
  titulo: string
  valor: string | number
  detalhe: string
  tom: string
}) {
  return (
    <Card3D className="flex items-start gap-4 rounded-xl border border-line bg-surface p-5 shadow-card transition-shadow duration-300 hover:border-primary/30 hover:shadow-card-hover">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ${tom}`}
      >
        {icone}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-content-muted">{titulo}</p>
        <p className="num mt-1 text-3xl font-extrabold tracking-tight text-content">
          {valor}
        </p>
        <p className="mt-1 text-[11px] text-content-muted">{detalhe}</p>
      </div>
    </Card3D>
  )
}

export function DashboardPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { ativos } = useAtivosStore()
  const { itens } = useEstoqueStore()
  const { manutencoes } = useManutencoesStore()
  const { solicitacoes } = useSolicitacoesStore()

  const ativosAtivos = ativos.filter((a) => a.status === 'Ativo')
  const itensRisco = itens.filter((i) => statusEstoque(i) !== 'Normal')
  const manutencoesAbertas = manutencoes.filter(
    (m) => m.status === 'Agendada' || m.status === 'Em Execução',
  )
  const manutencoesProximas = manutencoesAbertas.filter((m) => {
    const dias = diasAte(m.dataAgendada)
    return dias !== null && dias <= 5
  })
  const solicitacoesPendentes = solicitacoes.filter((s) => s.status === 'Enviada')

  const dadosStatus = ['Ativo', 'Inativo', 'Manutenção', 'Descartado'].map((nome) => ({
    nome,
    valor: ativos.filter((a) => a.status === nome).length,
  }))

  const porTipo = new Map<string, number>()
  ativos.forEach((a) => porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1))
  const dadosTipo = [...porTipo.entries()]
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const logs = lerColecao<LogEntrada>('LOG').slice(0, 6)
  const verSolicitacoes = usuario && podeAcessarRota('/solicitacoes', usuario.perfil)
  const dataExtenso = (() => {
    const d = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    return d.charAt(0).toUpperCase() + d.slice(1)
  })()

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <h1 className="text-2xl font-extrabold tracking-tight text-content">
          Visão <span className="gradient-text">geral</span>
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          Resumo do inventário de TI — {dataExtenso}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icone={<Box size={20} className="text-success" />}
          titulo="Ativos em uso"
          valor={ativosAtivos.length}
          detalhe={`${ativos.length} ativos no total`}
          tom="from-success/25 to-success/5"
        />
        <Metrica
          icone={<Package size={20} className="text-warning" />}
          titulo="Estoque em risco"
          valor={itensRisco.length}
          detalhe={`${itens.length} itens cadastrados`}
          tom="from-warning/25 to-warning/5"
        />
        <Metrica
          icone={<Wrench size={20} className="text-primary" />}
          titulo="Manutenções abertas"
          valor={manutencoesAbertas.length}
          detalhe={
            manutencoesProximas.length > 0
              ? `${manutencoesProximas.length} vencem em até 5 dias`
              : 'Nenhuma urgente'
          }
          tom="from-primary/25 to-primary/5"
        />
        {verSolicitacoes && (
          <Metrica
            icone={<CalendarClock size={20} className="text-info" />}
            titulo="Solicitações pendentes"
            valor={solicitacoesPendentes.length}
            detalhe={`${solicitacoes.length} solicitações no total`}
            tom="from-info/25 to-info/5"
          />
        )}
      </div>

      <Reveal atraso={40}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <p className="mb-4 text-sm font-semibold text-content">Ativos por status</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosStatus}
                    dataKey="valor"
                    nameKey="nome"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {dadosStatus.map((d) => (
                      <Cell key={d.nome} fill={CORES_STATUS[d.nome]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {dadosStatus.map((d) => (
                <span
                  key={d.nome}
                  className="flex items-center gap-1.5 text-[11px] text-content-muted"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: CORES_STATUS[d.nome] }}
                  />
                  {d.nome} ({d.valor})
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <p className="mb-4 text-sm font-semibold text-content">Ativos por tipo</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosTipo} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <XAxis
                    dataKey="tipo"
                    tick={{ fontSize: 10, fill: 'var(--content-muted)' }}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--content-muted)' }}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-3)' }}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" fill="#007AFF" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal atraso={100}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-content">
              <AlertTriangle size={16} className="text-warning" />
              Alertas de estoque
            </p>
            {itensRisco.length === 0 ? (
              <p className="py-4 text-sm text-content-muted">
                Nenhum item abaixo do mínimo. Tudo certo.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {itensRisco.map((i) => (
                  <li key={i.codigo} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm text-content">{i.descricao}</p>
                      <p className="text-xs text-content-muted">
                        {i.codigo} · mín. {i.quantidadeMinima}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-content">
                        {i.quantidade} {i.unidade}
                      </span>
                      <BadgeStatus status={statusEstoque(i)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-content">
              <Wrench size={16} className="text-primary" />
              Manutenções agendadas
            </p>
            {manutencoesAbertas.length === 0 ? (
              <p className="py-4 text-sm text-content-muted">
                Nenhuma manutenção em aberto.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {manutencoesAbertas.slice(0, 5).map((m) => {
                  const dias = diasAte(m.dataAgendada)
                  return (
                    <li key={m.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm text-content">{m.codigoAtivo}</p>
                        <p className="text-xs text-content-muted">{m.descricao}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-content">{formatarData(m.dataAgendada)}</p>
                        <p
                          className={`text-xs ${dias !== null && dias <= 5 ? 'text-danger' : 'text-content-muted'}`}
                        >
                          {dias !== null && dias >= 0
                            ? `em ${dias} dia(s)`
                            : 'atrasada'}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </Reveal>

      <Reveal atraso={160}>
        <Card>
          <p className="mb-3 text-sm font-semibold text-content">Atividade recente</p>
          {logs.length === 0 ? (
            <p className="text-sm text-content-muted">Nenhuma atividade registrada.</p>
          ) : (
            <ul className="divide-y divide-line">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  {l.acao === 'CREATE' ? (
                    <ArrowUpRight size={15} className="text-success" />
                  ) : l.acao === 'DELETE' ? (
                    <ArrowDownRight size={15} className="text-danger" />
                  ) : (
                    <ArrowUpRight size={15} className="text-info" />
                  )}
                  <span className="text-xs font-medium text-content">
                    {l.acao} · {l.tabela}
                  </span>
                  <span className="truncate text-xs text-content-muted">{l.registroId}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-content-muted">
                    {formatarData(l.dataHora)} · {l.usuario}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Reveal>
    </div>
  )
}
