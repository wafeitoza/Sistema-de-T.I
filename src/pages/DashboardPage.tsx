import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CalendarClock,
  History,
  Package,
  Wrench,
} from 'lucide-react'
import { lerColecao } from '../data/repository'
import { BadgeStatus } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Card3D } from '../components/ui/Card3D'
import { Reveal } from '../components/ui/Reveal'
import { cn } from '../lib/cn'
import { diasAte, formatarData, formatarMoeda } from '../lib/format'
import { podeAcessarRota, podeEditar } from '../lib/permissions'
import { statusEstoque } from '../store/estoque'
import { useAtivosStore } from '../store/ativos'
import { useAuthStore } from '../store/auth'
import { useEstoqueStore } from '../store/estoque'
import { useManutencoesStore } from '../store/manutencao'
import { useSolicitacoesStore } from '../store/solicitacoes'
import type { LogEntrada } from '../types'

const ACOES_PT: Record<string, string> = {
  CREATE: 'Criou',
  UPDATE: 'Atualizou',
  DELETE: 'Removeu',
  LOGIN: 'Entrou no sistema',
  LOGOUT: 'Saiu do sistema',
}

const PONTO_ACAO: Record<string, string> = {
  CREATE: 'bg-success',
  UPDATE: 'bg-primary',
  DELETE: 'bg-danger',
  LOGIN: 'bg-info',
  LOGOUT: 'bg-content-muted',
}

function Metrica({
  icone,
  titulo,
  valor,
  detalhe,
  tom,
  barra,
  progresso,
}: {
  icone: React.ReactNode
  titulo: string
  valor: string | number
  detalhe: string
  tom: string
  barra: string
  progresso: number
}) {
  const [largura, setLargura] = useState(0)
  const pct = Math.min(100, Math.max(0, Math.round(progresso * 100)))

  useEffect(() => {
    const t = setTimeout(() => setLargura(pct), 180)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <Card3D className="rounded-xl border border-line bg-surface p-5 shadow-card transition-all duration-300 hover:border-primary/30 hover:shadow-card-hover">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${tom}`}
        >
          {icone}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-content-muted">{titulo}</p>
          <p className="num mt-1 text-3xl font-extrabold tracking-tight text-content">
            {valor}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-content-muted">
        <span className="truncate">{detalhe}</span>
        <span className="num ml-2 shrink-0 font-semibold text-content">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-out ${barra}`}
          style={{ width: `${largura}%` }}
        />
      </div>
    </Card3D>
  )
}

function CabecalhoLista({
  icone,
  titulo,
  detalhe,
  cor,
  link,
  rotuloLink,
}: {
  icone: React.ReactNode
  titulo: string
  detalhe: string
  cor: string
  link: string
  rotuloLink: string
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${cor}`}
        >
          {icone}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content">{titulo}</p>
          <p className="truncate text-[11px] text-content-muted">{detalhe}</p>
        </div>
      </div>
      <Link
        to={link}
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/10 hover:shadow-sm active:scale-95"
      >
        {rotuloLink} →
      </Link>
    </div>
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

  const patrimonio = ativos.reduce((soma, a) => soma + (a.valorAquisicao ?? 0), 0)
  const valorEstoque = itens.reduce(
    (soma, i) => soma + i.quantidade * (i.precoUnitario ?? 0),
    0,
  )

  const logs = lerColecao<LogEntrada>('LOG').slice(0, 7)
  const verSolicitacoes = usuario && podeAcessarRota('/solicitacoes', usuario.perfil)
  const edita = usuario ? podeEditar(usuario.perfil) : false
  const [dataExtenso] = useState(() => {
    const d = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    return d.charAt(0).toUpperCase() + d.slice(1)
  })

  return (
    <div className="space-y-6">
      <section className="anim-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-dark to-info p-6 text-white shadow-xl shadow-primary/20">
        <span
          className="blob"
          style={{
            width: 240,
            height: 240,
            top: -70,
            right: -50,
            background: 'rgba(255, 255, 255, 0.16)',
            animationDelay: '-4s',
          }}
          aria-hidden
        />
        <span
          className="blob"
          style={{
            width: 170,
            height: 170,
            bottom: -60,
            left: '35%',
            background: 'rgba(255, 255, 255, 0.1)',
            animationDelay: '-9s',
          }}
          aria-hidden
        />
        <div className="shine relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">
              Resumo do inventário de TI
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              Visão geral
            </h1>
            <p className="mt-1.5 text-sm text-white/75">{dataExtenso}</p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/25">
                <p className="text-[11px] font-medium text-white/75">Patrimônio</p>
                <p className="num text-lg font-extrabold">{formatarMoeda(patrimonio)}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/25">
                <p className="text-[11px] font-medium text-white/75">Valor em estoque</p>
                <p className="num text-lg font-extrabold">{formatarMoeda(valorEstoque)}</p>
              </div>
            </div>
            {edita && (
              <Link
                to="/ativos"
                className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary shadow-lg shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-95"
              >
                Gerenciar ativos <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="anim-fade-up group" style={{ animationDelay: '60ms' }}>
          <Metrica
            icone={<Box size={20} className="text-success" />}
            titulo="Ativos em uso"
            valor={ativosAtivos.length}
            detalhe={`${ativos.length} ativos no total`}
            tom="from-success/25 to-success/5"
            barra="from-success to-info"
            progresso={ativos.length ? ativosAtivos.length / ativos.length : 0}
          />
        </div>
        <div className="anim-fade-up group" style={{ animationDelay: '120ms' }}>
          <Metrica
            icone={<Package size={20} className="text-warning" />}
            titulo="Estoque em risco"
            valor={itensRisco.length}
            detalhe={`${itens.length} itens cadastrados`}
            tom="from-warning/25 to-warning/5"
            barra="from-warning to-danger"
            progresso={itens.length ? itensRisco.length / itens.length : 0}
          />
        </div>
        <div className="anim-fade-up group" style={{ animationDelay: '180ms' }}>
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
            barra="from-primary to-info"
            progresso={manutencoes.length ? manutencoesAbertas.length / manutencoes.length : 0}
          />
        </div>
        {verSolicitacoes && (
          <div className="anim-fade-up group" style={{ animationDelay: '240ms' }}>
            <Metrica
              icone={<CalendarClock size={20} className="text-info" />}
              titulo="Solicitações pendentes"
              valor={solicitacoesPendentes.length}
              detalhe={`${solicitacoes.length} solicitações no total`}
              tom="from-info/25 to-info/5"
              barra="from-info to-primary"
              progresso={
                solicitacoes.length ? solicitacoesPendentes.length / solicitacoes.length : 0
              }
            />
          </div>
        )}
      </section>

      <Reveal atraso={80}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CabecalhoLista
              icone={<AlertTriangle size={16} className="text-warning" />}
              titulo="Alertas de estoque"
              detalhe={
                itensRisco.length > 0
                  ? `${itensRisco.length} item(ns) no limite ou abaixo`
                  : 'Tudo acima do mínimo'
              }
              cor="bg-warning/15"
              link="/estoque"
              rotuloLink="Ver estoque"
            />
            {itensRisco.length === 0 ? (
              <p className="py-4 text-sm text-content-muted">
                Nenhum item abaixo do mínimo. Tudo certo.
              </p>
            ) : (
              <ul className="space-y-1">
                {itensRisco.map((i, idx) => (
                  <li
                    key={i.codigo}
                    style={{ animationDelay: `${idx * 50}ms` }}
                    className="anim-fade-up -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-all duration-200 hover:translate-x-1 hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-content">{i.descricao}</p>
                      <p className="text-xs text-content-muted">
                        {i.codigo} · mín. {i.quantidadeMinima}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
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
            <CabecalhoLista
              icone={<Wrench size={16} className="text-primary" />}
              titulo="Manutenções agendadas"
              detalhe={
                manutencoesAbertas.length > 0
                  ? `${manutencoesAbertas.length} em aberto`
                  : 'Nenhuma em aberto'
              }
              cor="bg-primary/15"
              link="/manutencao"
              rotuloLink="Ver manutenções"
            />
            {manutencoesAbertas.length === 0 ? (
              <p className="py-4 text-sm text-content-muted">
                Nenhuma manutenção em aberto.
              </p>
            ) : (
              <ul className="space-y-1">
                {manutencoesAbertas.slice(0, 5).map((m, idx) => {
                  const dias = diasAte(m.dataAgendada)
                  const urgente = dias !== null && dias <= 5
                  return (
                    <li
                      key={m.id}
                      style={{ animationDelay: `${idx * 50}ms` }}
                      className="anim-fade-up -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-all duration-200 hover:translate-x-1 hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-content">{m.codigoAtivo}</p>
                        <p className="truncate text-xs text-content-muted">{m.descricao}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm text-content">{formatarData(m.dataAgendada)}</p>
                        <p
                          className={cn(
                            'text-xs font-medium',
                            urgente ? 'text-danger' : 'text-content-muted',
                          )}
                        >
                          {dias !== null && dias >= 0 ? `em ${dias} dia(s)` : 'atrasada'}
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

      <Reveal atraso={140}>
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info/15 shadow-sm">
              <History size={16} className="text-info" />
            </span>
            <div>
              <p className="text-sm font-semibold text-content">Atividade recente</p>
              <p className="text-[11px] text-content-muted">Últimas ações no sistema</p>
            </div>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-content-muted">Nenhuma atividade registrada.</p>
          ) : (
            <ul className="relative space-y-1 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-px before:bg-line">
              {logs.map((l, idx) => (
                <li
                  key={l.id}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  className="anim-fade-up relative flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors duration-200 hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      'z-10 h-3 w-3 shrink-0 rounded-full ring-4 ring-surface',
                      PONTO_ACAO[l.acao] ?? 'bg-content-muted',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">
                      <span className="font-semibold text-content">
                        {ACOES_PT[l.acao] ?? l.acao}
                      </span>{' '}
                      <span className="text-content-muted">em</span>{' '}
                      <span className="font-medium text-content">{l.tabela}</span>
                    </p>
                    <p className="truncate font-mono text-[11px] text-content-muted">
                      {l.registroId}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-[11px] text-content-muted">
                    {formatarData(l.dataHora)}
                    <br />
                    {l.usuario}
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
