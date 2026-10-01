import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Printer } from 'lucide-react'
import { Botao } from '../../components/ui/Botao'
import { Card, TituloSecao } from '../../components/ui/Card'
import { Entrada, Selecao } from '../../components/ui/Campos'
import { Resumo } from '../../components/ui/Resumo'
import { exportarCSV } from '../../lib/exportar'
import { dataBRparaDate, formatarMoeda, hojeBR } from '../../lib/format'
import { useAtivosStore } from '../../store/ativos'
import { useAuthStore } from '../../store/auth'
import { useEstoqueStore, statusEstoque } from '../../store/estoque'
import { useManutencoesStore } from '../../store/manutencao'
import type { Perfil } from '../../types'

const CORES_STATUS: Record<string, string> = {
  Ativo: '#34c759',
  Inativo: '#8e8e93',
  Manutenção: '#ff9500',
  Descartado: '#ff3b30',
}
const CORES = [
  '#007aff',
  '#ff9500',
  '#34c759',
  '#ff3b30',
  '#5ac8fa',
  '#af52de',
  '#ffcc00',
  '#8e8e93',
]
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const ORDENACAO_STATUS = ['Ativo', 'Manutenção', 'Inativo', 'Descartado']

function chaveMes(br: string): string | null {
  const d = dataBRparaDate(br)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-')
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`
}

function montarFaixa(de: string, ate: string): string[] {
  const hoje = new Date()
  const inicio = de ? dataBRparaDate(de) : null
  const fim = ate ? dataBRparaDate(ate) : null
  const ini = inicio ?? new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1)
  const fimDate = fim ?? hoje
  const chaves: string[] = []
  const atual = new Date(ini.getFullYear(), ini.getMonth(), 1)
  const limite = new Date(fimDate.getFullYear(), fimDate.getMonth(), 1)
  while (atual <= limite && chaves.length < 36) {
    chaves.push(
      `${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}`,
    )
    atual.setMonth(atual.getMonth() + 1)
  }
  return chaves
}

function Grafico({
  titulo,
  vazio,
  children,
}: {
  titulo: string
  vazio?: boolean
  children: ReactNode
}) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-content">{titulo}</h3>
      {vazio ? (
        <p className="flex h-[260px] items-center justify-center text-sm text-content-muted">
          Sem dados no período selecionado.
        </p>
      ) : (
        children
      )}
    </Card>
  )
}

export function RelatoriosPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { ativos } = useAtivosStore()
  const { itens, entradas, saidas } = useEstoqueStore()
  const { manutencoes } = useManutencoesStore()

  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [setor, setSetor] = useState('')

  const setores = useMemo(
    () => [...new Set(ativos.map((a) => a.setor))].sort(),
    [ativos],
  )

  const faixa = useMemo(() => montarFaixa(de, ate), [de, ate])

  const noPeriodo = useCallback(
    (valor: string): boolean => {
      const d = dataBRparaDate(valor)
      if (!d) return true
      if (de && d < new Date(`${de}T00:00:00`)) return false
      if (ate && d > new Date(`${ate}T23:59:59`)) return false
      return true
    },
    [de, ate],
  )

  const ativosFiltrados = useMemo(
    () => ativos.filter((a) => !setor || a.setor === setor),
    [ativos, setor],
  )

  const patrimonio = ativosFiltrados.reduce(
    (soma, a) => soma + (a.valorAquisicao ?? 0),
    0,
  )
  const emRisco = itens.filter((i) => statusEstoque(i) !== 'Normal').length
  const abertas = manutencoes.filter(
    (m) => m.status === 'Agendada' || m.status === 'Em Execução',
  ).length

  const porStatus = useMemo(() => {
    const conta = new Map<string, number>()
    for (const a of ativosFiltrados) {
      conta.set(a.status, (conta.get(a.status) ?? 0) + 1)
    }
    return ORDENACAO_STATUS.filter((s) => conta.has(s)).map((s) => ({
      name: s,
      value: conta.get(s) ?? 0,
    }))
  }, [ativosFiltrados])

  const porSetor = useMemo(() => {
    const conta = new Map<string, number>()
    for (const a of ativos) conta.set(a.setor, (conta.get(a.setor) ?? 0) + 1)
    return [...conta.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [ativos])

  const aquisicoes = useMemo(() => {
    const conta = new Map<string, number>()
    for (const chave of faixa) conta.set(chave, 0)
    for (const a of ativosFiltrados) {
      if (!noPeriodo(a.dataAquisicao)) continue
      const chave = chaveMes(a.dataAquisicao)
      if (chave && conta.has(chave)) conta.set(chave, (conta.get(chave) ?? 0) + 1)
    }
    return faixa.map((chave) => ({ mes: rotuloMes(chave), qtd: conta.get(chave) ?? 0 }))
  }, [ativosFiltrados, faixa, noPeriodo])

  const movimentacoes = useMemo(() => {
    const conta = new Map<string, { ent: number; sai: number }>()
    for (const chave of faixa) conta.set(chave, { ent: 0, sai: 0 })
    for (const e of entradas) {
      if (!noPeriodo(e.data)) continue
      const chave = chaveMes(e.data)
      const c = chave ? conta.get(chave) : undefined
      if (c) c.ent += e.quantidade
    }
    for (const s of saidas) {
      if (!noPeriodo(s.data)) continue
      const chave = chaveMes(s.data)
      const c = chave ? conta.get(chave) : undefined
      if (c) c.sai += s.quantidade
    }
    return faixa.map((chave) => {
      const c = conta.get(chave) ?? { ent: 0, sai: 0 }
      return { mes: rotuloMes(chave), Entradas: c.ent, Saídas: c.sai }
    })
  }, [entradas, saidas, faixa, noPeriodo])

  const manutencoesPorTipo = useMemo(() => {
    const filtradas = manutencoes.filter((m) => noPeriodo(m.dataAgendada))
    const conta = new Map<string, number>()
    for (const m of filtradas) conta.set(m.tipo, (conta.get(m.tipo) ?? 0) + 1)
    return [...conta.entries()].map(([name, value]) => ({ name, value }))
  }, [manutencoes, noPeriodo])

  const estoquePorCategoria = useMemo(() => {
    const conta = new Map<string, number>()
    for (const i of itens) conta.set(i.categoria, (conta.get(i.categoria) ?? 0) + 1)
    return [...conta.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [itens])

  function exportar() {
    const linhas: (string | number)[][] = [
      ['Ativos no filtro', ativosFiltrados.length],
      ['Patrimônio (aquisição)', formatarMoeda(patrimonio)],
      ...porStatus.map((s) => [`Ativos — ${s.name}`, s.value]),
      ...porSetor.map((s) => [`Setor — ${s.name}`, s.value]),
      ...manutencoesPorTipo.map((m) => [`Manutenções — ${m.name}`, m.value]),
      ['Itens em risco de estoque', emRisco],
      ['Manutenções abertas', abertas],
    ]
    exportarCSV('relatorios.csv', ['Indicador', 'Valor'], linhas, [
      `Relatório exportado por ${usuario?.email ?? '—'}`,
      `Filtros: setor=${setor || 'todos'} · período=${de || '…'} a ${ate || '…'}`,
      `Data da exportação: ${hojeBR()}`,
    ])
  }

  const tooltipStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--content)',
  } as const

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir / PDF
            </Botao>
            <Botao onClick={exportar}>
              <Download size={16} /> Exportar CSV
            </Botao>
          </div>
        }
      >
        Relatórios
      </TituloSecao>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
        <Entrada
          label="Período de"
          type="date"
          value={de}
          onChange={(e) => setDe(e.target.value)}
        />
        <Entrada
          label="Período até"
          type="date"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
        />
        <Selecao
          label="Setor"
          value={setor}
          onChange={(e) => setSetor(e.target.value)}
          opcoes={setores.map((s) => ({ valor: s, rotulo: s }))}
          placeholder="Todos os setores"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Ativos" valor={ativosFiltrados.length} />
        <Resumo titulo="Patrimônio" valor={formatarMoeda(patrimonio)} />
        <Resumo titulo="Itens em risco" valor={emRisco} destaque={emRisco > 0} />
        <Resumo titulo="Manutenções abertas" valor={abertas} destaque={abertas > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Grafico titulo="Ativos por status" vazio={porStatus.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={porStatus}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {porStatus.map((s) => (
                  <Cell key={s.name} fill={CORES_STATUS[s.name] ?? '#8e8e93'} />
                ))}
              </Pie>
              <Legend />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Grafico>

        <Grafico titulo="Ativos por setor" vazio={porSetor.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porSetor}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} height={50} textAnchor="end" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(0 122 255 / 0.08)' }} />
              <Bar dataKey="value" fill="#007aff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>

        <Grafico titulo="Aquisições por mês" vazio={faixa.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={aquisicoes}>
              <defs>
                <linearGradient id="gradAquis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#007aff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#007aff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="qtd"
                name="Aquisições"
                stroke="#007aff"
                strokeWidth={2}
                fill="url(#gradAquis)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Grafico>

        <Grafico titulo="Manutenções por tipo" vazio={manutencoesPorTipo.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={manutencoesPorTipo}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(0 122 255 / 0.08)' }} />
              <Bar dataKey="value" name="Manutenções" radius={[6, 6, 0, 0]}>
                {manutencoesPorTipo.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>

        <Grafico titulo="Movimentações de estoque por mês" vazio={faixa.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={movimentacoes}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(0 122 255 / 0.08)' }} />
              <Legend />
              <Bar dataKey="Entradas" fill="#34c759" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saídas" fill="#ff3b30" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>

        <Grafico titulo="Itens de estoque por categoria" vazio={estoquePorCategoria.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={estoquePorCategoria}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} height={50} textAnchor="end" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(0 122 255 / 0.08)' }} />
              <Bar dataKey="value" name="Itens" radius={[6, 6, 0, 0]}>
                {estoquePorCategoria.map((_, i) => (
                  <Cell key={i} fill={CORES[(i + 3) % CORES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>

      <p className="text-xs text-content-muted print:hidden">
        Perfis com acesso: {(['Admin', 'Gerente', 'Visualizador'] as Perfil[]).join(', ')}.
        Use “Imprimir / PDF” para gerar um PDF no navegador.
      </p>
    </div>
  )
}
