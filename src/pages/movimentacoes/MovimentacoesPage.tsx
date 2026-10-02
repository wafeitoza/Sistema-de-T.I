import { useMemo, useState } from 'react'
import { ArrowLeftRight, Ban, Check, Plus, Search } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Selecao } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Paginacao } from '../../components/ui/Paginacao'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { formatarData } from '../../lib/format'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAuthStore } from '../../store/auth'
import { useMovimentacoesStore } from '../../store/movimentacoes'
import { useUiStore } from '../../store/ui'
import type { Movimentacao, StatusMovimentacao } from '../../types'
import { MovimentacaoFormModal } from './MovimentacaoFormModal'

const TOM_STATUS: Record<StatusMovimentacao, 'warning' | 'success' | 'danger'> = {
  Pendente: 'warning',
  Confirmada: 'success',
  Cancelada: 'danger',
}

const STATUS_OPCOES = [
  { valor: '', rotulo: 'Todos os status' },
  { valor: 'Pendente', rotulo: 'Pendente' },
  { valor: 'Confirmada', rotulo: 'Confirmada' },
  { valor: 'Cancelada', rotulo: 'Cancelada' },
]

export function MovimentacoesPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { movimentacoes, confirmar, cancelar } = useMovimentacoesStore()
  const notificar = useUiStore((s) => s.notificar)
  const podeAgir =
    usuario?.perfil === 'Admin' ||
    usuario?.perfil === 'Gerente' ||
    usuario?.perfil === 'Técnico'

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalForm, setModalForm] = useState(false)
  const [paraConfirmar, setParaConfirmar] = useState<Movimentacao | null>(null)
  const [paraCancelar, setParaCancelar] = useState<Movimentacao | null>(null)
  const { ord, ordenar } = useOrdenacao('criadoEm')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return movimentacoes.filter((m) => {
      if (filtroStatus && m.status !== filtroStatus) return false
      if (!termo) return true
      return (
        m.id.toLowerCase().includes(termo) ||
        m.codigoAtivo.toLowerCase().includes(termo) ||
        m.setorOrigem.toLowerCase().includes(termo) ||
        m.setorDestino.toLowerCase().includes(termo) ||
        m.responsavelDestino.toLowerCase().includes(termo)
      )
    })
  }, [movimentacoes, busca, filtroStatus])

  const ordenados = ordenarPor(filtrados, ord)
  const pag = usePaginacao(ordenados.length)
  const visiveis = ordenados.slice(pag.inicio, pag.fim)

  const pendentes = movimentacoes.filter((m) => m.status === 'Pendente').length

  function aoConfirmar() {
    if (!paraConfirmar) return
    const resultado = confirmar(paraConfirmar.id)
    if (!resultado.ok) {
      notificar('erro', resultado.erro ?? 'Não foi possível confirmar.')
    } else {
      notificar(
        'sucesso',
        `${paraConfirmar.codigoAtivo} transferido para ${paraConfirmar.setorDestino}.`,
      )
    }
    setParaConfirmar(null)
  }

  function aoCancelar() {
    if (!paraCancelar) return
    const resultado = cancelar(paraCancelar.id)
    if (!resultado.ok) {
      notificar('erro', resultado.erro ?? 'Não foi possível cancelar.')
    } else {
      notificar('sucesso', `${paraCancelar.id} cancelada.`)
    }
    setParaCancelar(null)
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          podeAgir ? (
            <Botao onClick={() => setModalForm(true)}>
              <Plus size={16} /> Nova movimentação
            </Botao>
          ) : null
        }
      >
        Movimentações de ativos
      </TituloSecao>

      {pendentes > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-content">
          <ArrowLeftRight size={16} className="shrink-0 text-warning" />
          <span>
            <strong>{pendentes}</strong> movimentação(ões) pendente(s) aguardando confirmação do
            destino.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar ID, ativo, setor ou responsável…"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Selecao
          label=""
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          opcoes={STATUS_OPCOES}
          className="[&_span]:hidden"
        />
      </div>

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma movimentação"
          mensagem="Registre a transferência de um ativo entre setores; ela fica pendente até a confirmação."
          acao={
            podeAgir ? (
              <Botao tamanho="sm" onClick={() => setModalForm(true)}>
                <Plus size={14} /> Nova movimentação
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={[
              'ID',
              'Ativo',
              'Origem',
              'Destino',
              'Responsável destino',
              'Criada em',
              'Status',
              'Ações',
            ]}
            chaves={[
              'id',
              'codigoAtivo',
              'setorOrigem',
              'setorDestino',
              'responsavelDestino',
              'criadoEm',
              'status',
              null,
            ]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((m) => (
              <Linha key={m.id}>
                <Celula className="whitespace-nowrap font-mono text-xs font-semibold">
                  {m.id}
                </Celula>
                <Celula className="font-mono text-xs">{m.codigoAtivo}</Celula>
                <Celula className="text-xs">{m.setorOrigem}</Celula>
                <Celula className="text-xs font-medium">{m.setorDestino}</Celula>
                <Celula className="text-xs">{m.responsavelDestino}</Celula>
                <Celula className="whitespace-nowrap text-xs text-content-muted">
                  {formatarData(m.criadoEm)}
                </Celula>
                <Celula>
                  <Badge tom={TOM_STATUS[m.status]}>{m.status}</Badge>
                </Celula>
                <Celula>
                  {podeAgir && m.status === 'Pendente' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setParaConfirmar(m)}
                        className="rounded-lg p-1.5 text-content-muted hover:bg-success/15 hover:text-success"
                        title="Confirmar"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setParaCancelar(m)}
                        className="rounded-lg p-1.5 text-content-muted hover:bg-danger/15 hover:text-danger"
                        title="Cancelar"
                      >
                        <Ban size={16} />
                      </button>
                    </div>
                  )}
                </Celula>
              </Linha>
            ))}
          </tbody>
        </Tabela>
      )}

      {filtrados.length > 0 && (
        <Paginacao
          pagina={pag.pagina}
          totalPaginas={pag.totalPaginas}
          totalItens={filtrados.length}
          exibindoDe={pag.inicio + 1}
          exibindoAte={pag.fim}
          aoMudar={pag.setPagina}
        />
      )}

      <MovimentacaoFormModal aberto={modalForm} aoFechar={() => setModalForm(false)} />

      <Modal
        aberto={!!paraConfirmar}
        aoFechar={() => setParaConfirmar(null)}
        titulo={`Confirmar ${paraConfirmar?.id ?? ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaConfirmar(null)}>
              Voltar
            </Botao>
            <Botao onClick={aoConfirmar}>Confirmar</Botao>
          </>
        }
      >
        <p className="text-sm text-content">
          Confirmar a transferência de{' '}
          <strong className="font-mono">{paraConfirmar?.codigoAtivo}</strong> de{' '}
          <strong>{paraConfirmar?.setorOrigem}</strong> para{' '}
          <strong>{paraConfirmar?.setorDestino}</strong>? O setor do ativo será atualizado e a
          confirmação ficará registrada na auditoria.
        </p>
      </Modal>

      <Modal
        aberto={!!paraCancelar}
        aoFechar={() => setParaCancelar(null)}
        titulo={`Cancelar ${paraCancelar?.id ?? ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaCancelar(null)}>
              Voltar
            </Botao>
            <Botao variante="perigo" onClick={aoCancelar}>
              Cancelar movimentação
            </Botao>
          </>
        }
      >
        <p className="text-sm text-content">
          Cancelar a movimentação de{' '}
          <strong className="font-mono">{paraCancelar?.codigoAtivo}</strong> para{' '}
          <strong>{paraCancelar?.setorDestino}</strong>? O ativo permanece em{' '}
          <strong>{paraCancelar?.setorOrigem}</strong>.
        </p>
      </Modal>
    </div>
  )
}
