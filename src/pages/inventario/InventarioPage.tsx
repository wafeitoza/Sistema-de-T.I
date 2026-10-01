import { useMemo, useState } from 'react'
import { ClipboardCheck, Download, ListChecks, Plus, Search } from 'lucide-react'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Selecao } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Resumo } from '../../components/ui/Resumo'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { cn } from '../../lib/cn'
import { SETORES, TIPOS_ATIVO } from '../../lib/codes'
import { exportarCSV } from '../../lib/exportar'
import { formatarData, formatarMoeda } from '../../lib/format'
import { podeEditar } from '../../lib/permissions'
import { useAtivosStore } from '../../store/ativos'
import { useAuthStore } from '../../store/auth'
import { useEstoqueStore } from '../../store/estoque'
import { useInventarioStore } from '../../store/inventario'
import { useUiStore } from '../../store/ui'
import type { Contagem, StatusAtivo } from '../../types'
import { ContagemDetalheModal, NovaContagemModal } from './InventarioModals'

const STATUS_ATIVO: StatusAtivo[] = ['Ativo', 'Inativo', 'Manutenção', 'Descartado']

type Aba = 'contagem' | 'relatorio'

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'contagem', rotulo: 'Contagem de estoque' },
  { id: 'relatorio', rotulo: 'Relatório de ativos' },
]

export function InventarioPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { contagens } = useInventarioStore()
  const { itens } = useEstoqueStore()
  const { ativos } = useAtivosStore()
  const notificar = useUiStore((s) => s.notificar)
  const editar = podeEditar(usuario?.perfil ?? 'Visualizador')

  const [aba, setAba] = useState<Aba>('contagem')
  const [novaAberta, setNovaAberta] = useState(false)
  const [contagemAberta, setContagemAberta] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroSetor, setFiltroSetor] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  const contagemSelecionada = contagens.find((c) => c.id === contagemAberta) ?? null

  function divergenciasDe(c: Contagem): number {
    return c.itens.filter((ic) => {
      if (ic.contado === null) return false
      const item = itens.find((i) => i.codigo === ic.codigoItem)
      return item !== undefined && ic.contado !== item.quantidade
    }).length
  }

  function contadosDe(c: Contagem): number {
    return c.itens.filter((i) => i.contado !== null).length
  }

  const abertas = contagens.filter((c) => c.status === 'Em andamento')
  const totalPendentes = abertas.reduce((s, c) => s + (c.itens.length - contadosDe(c)), 0)
  const divergenciasAbertas = abertas.reduce((s, c) => s + divergenciasDe(c), 0)

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return ativos.filter((a) => {
      if (filtroStatus && a.status !== filtroStatus) return false
      if (filtroSetor && a.setor !== filtroSetor) return false
      if (filtroTipo && a.tipo !== filtroTipo) return false
      if (!termo) return true
      return (
        a.codigo.toLowerCase().includes(termo) ||
        a.descricao.toLowerCase().includes(termo) ||
        a.responsavel.toLowerCase().includes(termo) ||
        (a.serial ?? '').toLowerCase().includes(termo)
      )
    })
  }, [ativos, busca, filtroStatus, filtroSetor, filtroTipo])

  const valorTotal = filtrados.reduce((soma, a) => soma + (a.valorAquisicao ?? 0), 0)
  const emManutencao = filtrados.filter((a) => a.status === 'Manutenção').length
  const descartados = filtrados.filter((a) => a.status === 'Descartado').length

  const temFiltro = !!(busca || filtroStatus || filtroSetor || filtroTipo)

  function descricaoFiltros(): string {
    const partes = [
      filtroStatus ? `status=${filtroStatus}` : null,
      filtroSetor ? `setor=${filtroSetor}` : null,
      filtroTipo ? `tipo=${filtroTipo}` : null,
      busca ? `busca="${busca}"` : null,
    ].filter(Boolean)
    return partes.length ? partes.join(', ') : 'nenhum'
  }

  function exportarRelatorio() {
    if (filtrados.length === 0) {
      notificar('erro', 'Nenhum ativo para exportar com os filtros atuais.')
      return
    }
    const colunas = [
      'Código',
      'Tombamento',
      'Descrição',
      'Tipo',
      'Marca',
      'Modelo',
      'Serial',
      'Setor',
      'Responsável',
      'Status',
      'Localização',
      'Aquisição',
      'Valor (R$)',
      'Última manutenção',
      'Próxima manutenção',
    ]
    const linhas = filtrados.map((a) => [
      a.codigo,
      a.tombamento ?? '',
      a.descricao,
      a.tipo,
      a.marca ?? '',
      a.modelo ?? '',
      a.serial ?? '',
      a.setor,
      a.responsavel,
      a.status,
      a.localizacao ?? '',
      formatarData(a.dataAquisicao),
      a.valorAquisicao !== undefined ? formatarMoeda(a.valorAquisicao) : '',
      a.ultimaManutencao ? formatarData(a.ultimaManutencao) : '',
      a.proximaManutencao ? formatarData(a.proximaManutencao) : '',
    ])
    exportarCSV(
      `inventario-ativos-${new Date().toISOString().slice(0, 10)}.csv`,
      colunas,
      linhas,
      [
        'Inventário de ativos — IT Stock',
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        `Gerado por: ${usuario?.nome ?? ''} (${usuario?.email ?? ''})`,
        `Filtros: ${descricaoFiltros()}`,
        `Total exportado: ${filtrados.length} de ${ativos.length} ativos`,
      ],
    )
    notificar('sucesso', `Relatório exportado com ${filtrados.length} ativo(s).`)
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          aba === 'contagem' ? (
            editar ? (
              <Botao onClick={() => setNovaAberta(true)}>
                <Plus size={16} /> Nova contagem
              </Botao>
            ) : null
          ) : (
            <Botao variante="secundario" onClick={exportarRelatorio}>
              <Download size={16} /> Exportar CSV
            </Botao>
          )
        }
      >
        Inventário
      </TituloSecao>

      <div className="flex w-fit gap-1 rounded-xl border border-line bg-surface p-1">
        {ABAS.map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              aba === t.id
                ? 'bg-primary text-white'
                : 'text-content-muted hover:bg-surface-2 hover:text-content',
            )}
          >
            {t.id === 'contagem' ? <ClipboardCheck size={16} /> : <Download size={16} />}
            {t.rotulo}
          </button>
        ))}
      </div>

      {aba === 'contagem' ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Resumo titulo="Contagens realizadas" valor={String(contagens.length)} />
            <Resumo titulo="Em andamento" valor={String(abertas.length)} />
            <Resumo titulo="Itens a contar" valor={String(totalPendentes)} />
            <Resumo
              titulo="Divergências abertas"
              valor={String(divergenciasAbertas)}
              destaque={divergenciasAbertas > 0}
            />
          </div>

          {contagens.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma contagem ainda"
              mensagem="Crie uma contagem para comparar o saldo do estoque com a contagem física."
              acao={
                editar ? (
                  <Botao tamanho="sm" onClick={() => setNovaAberta(true)}>
                    <Plus size={14} /> Nova contagem
                  </Botao>
                ) : null
              }
            />
          ) : (
            <Tabela>
              <CabecalhoTabela
                colunas={[
                  'Código',
                  'Contagem',
                  'Progresso',
                  'Divergências',
                  'Status',
                  'Data',
                  'Responsável',
                  'Ações',
                ]}
              />
              <tbody>
                {contagens.map((c) => {
                  const contados = contadosDe(c)
                  const divergencias = divergenciasDe(c)
                  return (
                    <Linha key={c.id}>
                      <Celula className="font-mono text-xs font-semibold">{c.id}</Celula>
                      <Celula>
                        <p className="font-medium">{c.nome}</p>
                      </Celula>
                      <Celula className="text-xs">
                        <span className="font-semibold">{contados}</span>/{c.itens.length}{' '}
                        contados
                      </Celula>
                      <Celula>
                        {divergencias > 0 ? (
                          <Badge tom="danger">{divergencias}</Badge>
                        ) : (
                          <span className="text-xs text-content-muted">—</span>
                        )}
                      </Celula>
                      <Celula>
                        <BadgeStatus status={c.status} />
                      </Celula>
                      <Celula className="text-xs text-content-muted">{c.data}</Celula>
                      <Celula className="text-xs text-content-muted">{c.responsavel}</Celula>
                      <Celula>
                        <button
                          onClick={() => setContagemAberta(c.id)}
                          className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-primary"
                          title="Abrir contagem"
                        >
                          <ListChecks size={16} />
                        </button>
                      </Celula>
                    </Linha>
                  )
                })}
              </tbody>
            </Tabela>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
              />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar código, descrição, serial…"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Selecao
              label=""
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              opcoes={TIPOS_ATIVO.map((t) => ({ valor: t, rotulo: t }))}
              placeholder="Todos os tipos"
              className="[&_span]:hidden"
            />
            <Selecao
              label=""
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              opcoes={SETORES.map((s) => ({ valor: s, rotulo: s }))}
              placeholder="Todos os setores"
              className="[&_span]:hidden"
            />
            <Selecao
              label=""
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              opcoes={STATUS_ATIVO.map((s) => ({ valor: s, rotulo: s }))}
              placeholder="Todos os status"
              className="[&_span]:hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Resumo titulo="Ativos no relatório" valor={String(filtrados.length)} />
            <Resumo titulo="Valor total" valor={formatarMoeda(valorTotal)} />
            <Resumo titulo="Em manutenção" valor={String(emManutencao)} destaque={emManutencao > 0} />
            <Resumo titulo="Descartados" valor={String(descartados)} />
          </div>

          {filtrados.length === 0 ? (
            <EstadoVazio
              titulo="Nenhum ativo encontrado"
              mensagem="Ajuste os filtros para gerar o relatório."
            />
          ) : (
            <Tabela>
              <CabecalhoTabela
                colunas={[
                  'Código',
                  'Tombamento',
                  'Descrição',
                  'Setor',
                  'Responsável',
                  'Status',
                  'Valor',
                  'Próx. manutenção',
                ]}
              />
              <tbody>
                {filtrados.map((a) => (
                  <Linha key={a.codigo}>
                    <Celula className="font-mono text-xs font-semibold">{a.codigo}</Celula>
                    <Celula className="font-mono text-xs">{a.tombamento ?? '—'}</Celula>
                    <Celula>
                      <p className="font-medium">{a.descricao}</p>
                      <p className="text-xs text-content-muted">
                        {[a.marca, a.modelo].filter(Boolean).join(' · ') || a.tipo}
                      </p>
                    </Celula>
                    <Celula className="text-xs">{a.setor}</Celula>
                    <Celula className="text-xs">{a.responsavel}</Celula>
                    <Celula>
                      <BadgeStatus status={a.status} />
                    </Celula>
                    <Celula className="text-xs">
                      {a.valorAquisicao !== undefined ? formatarMoeda(a.valorAquisicao) : '—'}
                    </Celula>
                    <Celula className="text-xs text-content-muted">
                      {a.proximaManutencao ? formatarData(a.proximaManutencao) : '—'}
                    </Celula>
                  </Linha>
                ))}
              </tbody>
            </Tabela>
          )}

          <p className="text-xs text-content-muted">
            {filtrados.length} de {ativos.length} ativos no relatório
            {temFiltro ? ' (filtros aplicados)' : ''}. Exporte em CSV com o botão acima.
          </p>
        </>
      )}

      <NovaContagemModal aberto={novaAberta} aoFechar={() => setNovaAberta(false)} />

      <ContagemDetalheModal
        aberto={!!contagemSelecionada}
        aoFechar={() => setContagemAberta(null)}
        contagem={contagemSelecionada}
        podeEditar={editar}
      />
    </div>
  )
}
