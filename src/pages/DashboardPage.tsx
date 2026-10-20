import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CalendarClock,
  LifeBuoy,
  Mail,
  Package,
  Wrench,
} from 'lucide-react'
import { Badge, BadgeStatus } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Card3D } from '../components/ui/Card3D'
import { Reveal } from '../components/ui/Reveal'
import { cn } from '../lib/cn'
import { tomPrioridade } from '../components/ui/tom'
import { diasAte, formatarData } from '../lib/format'
import { podeAcessarRota, podeEditar } from '../lib/permissions'
import { statusEstoque } from '../store/estoque'
import { useAtivosStore } from '../store/ativos'
import { useAuthStore } from '../store/auth'
import { useChamadosStore } from '../store/chamados'
import { useEstoqueStore } from '../store/estoque'
import { useManutencoesStore } from '../store/manutencao'
import { useSolicitacoesStore } from '../store/solicitacoes'
import type { Chamado, StatusChamado } from '../types'

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
  /** Sem link quando o perfil não pode abrir a rota (ex.: Visualizador). */
  link?: string
  rotuloLink?: string
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
      {link && rotuloLink && (
        <Link
          to={link}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/10 hover:shadow-sm active:scale-95"
        >
          {rotuloLink} →
        </Link>
      )}
    </div>
  )
}

/** Ordem da fila: o que ninguém olhou vem primeiro. */
const ORDEM_STATUS_CHAMADO: Record<StatusChamado, number> = {
  Aberto: 0,
  'Em atendimento': 1,
  'Aguardando usuário': 2,
  Resolvido: 3,
  Cancelado: 4,
}

function CardChamado({ chamado, para }: { chamado: Chamado; para?: string }) {
  const conteudo = (
    <Card className="h-full p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-content-muted">
          {chamado.id}
        </span>
        {chamado.origem === 'E-mail' && (
          <span
            className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-content-muted"
            title="Veio da sincronização com o e-mail"
          >
            <Mail size={11} /> e-mail
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-content">
        {chamado.assunto}
      </p>
      <p className="mt-0.5 truncate text-xs text-content-muted">{chamado.solicitante}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tom={tomPrioridade(chamado.prioridade)}>{chamado.prioridade}</Badge>
        <BadgeStatus status={chamado.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-content-muted">
        <span className="truncate">{chamado.atribuidoA ?? 'Sem responsável'}</span>
        <span className="shrink-0">{formatarData(chamado.criadoEm)}</span>
      </div>
    </Card>
  )
  return para ? (
    <Link to={para} className="block h-full">
      {conteudo}
    </Link>
  ) : (
    conteudo
  )
}

export function DashboardPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { ativos } = useAtivosStore()
  const { itens } = useEstoqueStore()
  const { manutencoes } = useManutencoesStore()
  const { solicitacoes } = useSolicitacoesStore()
  const { chamados } = useChamadosStore()

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

  // 'Em aberto' = ainda não resolvido nem cancelado — o resto é história.
  const chamadosAbertos = chamados.filter(
    (c) => c.status !== 'Resolvido' && c.status !== 'Cancelado',
  )
  const chamadosCriticos = chamadosAbertos.filter((c) => c.prioridade === 'Crítica')
  const chamadosOrdenados = [...chamados].sort(
    (a, b) =>
      (ORDEM_STATUS_CHAMADO[a.status] ?? 9) - (ORDEM_STATUS_CHAMADO[b.status] ?? 9) ||
      (a.atualizadoEm < b.atualizadoEm ? 1 : -1),
  )
  // Visualizador lê a fila no dashboard (mesmo RLS), mas não abre a rota.
  const verFilaChamados = usuario ? podeAcessarRota('/chamados', usuario.perfil) : false

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

      {/* 5 métricas para Admin/Gerente (com solicitações); 4 para os
          demais — a grade de 5 no xl deixa o espaço final vazio sem quebrar. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        <div className="anim-fade-up group" style={{ animationDelay: '300ms' }}>
          <Metrica
            icone={<LifeBuoy size={20} className="text-danger" />}
            titulo="Chamados em aberto"
            valor={chamadosAbertos.length}
            detalhe={
              chamadosCriticos.length > 0
                ? `${chamadosCriticos.length} crítica(s) · ${chamados.length} no total`
                : `${chamados.length} chamados no total`
            }
            tom="from-danger/25 to-danger/5"
            barra="from-danger to-warning"
            progresso={chamados.length ? chamadosAbertos.length / chamados.length : 0}
          />
        </div>
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

      <Reveal atraso={110}>
        <Card>
          <CabecalhoLista
            icone={<LifeBuoy size={16} className="text-danger" />}
            titulo="Fila de chamados"
            detalhe={
              chamadosAbertos.length > 0
                ? `${chamadosAbertos.length} em aberto · mais antigo primeiro`
                : 'Nenhum chamado em aberto'
            }
            cor="bg-danger/15"
            link={verFilaChamados ? '/chamados' : undefined}
            rotuloLink={verFilaChamados ? 'Ver chamados' : undefined}
          />
          {chamados.length === 0 ? (
            <p className="py-4 text-sm text-content-muted">
              Nenhum chamado registrado. A fila vem dos e-mails do GLPI e da tela de Chamados.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {chamadosOrdenados.slice(0, 6).map((c, idx) => (
                <div
                  key={c.id}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  className="anim-fade-up"
                >
                  <CardChamado chamado={c} para={verFilaChamados ? '/chamados' : undefined} />
                </div>
              ))}
            </div>
          )}
          {chamadosOrdenados.length > 6 && verFilaChamados && (
            <p className="mt-3 text-right text-xs text-content-muted">
              + {chamadosOrdenados.length - 6} outro(s) na fila ·{' '}
              <Link to="/chamados" className="font-semibold text-primary hover:underline">
                ver todos
              </Link>
            </p>
          )}
        </Card>
      </Reveal>
    </div>
  )
}
