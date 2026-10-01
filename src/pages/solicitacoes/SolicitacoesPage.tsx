import { useState } from 'react'
import {
  Check,
  ClipboardList,
  Copy,
  Link2,
  Pencil,
  Plus,
  Send,
  X,
} from 'lucide-react'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { AreaTexto } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Paginacao } from '../../components/ui/Paginacao'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { montarLinkAprovacao } from '../../lib/token'
import { podeCriarSolicitacao } from '../../lib/permissions'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAuthStore } from '../../store/auth'
import { useSolicitacoesStore } from '../../store/solicitacoes'
import { useUiStore } from '../../store/ui'
import type { Prioridade, Solicitacao, StatusSolicitacao } from '../../types'
import { SolicitacaoFormModal } from './SolicitacaoFormModal'

type Aba = 'Todas' | StatusSolicitacao

const ABAS: Aba[] = [
  'Todas',
  'Rascunho',
  'Enviada',
  'Aprovada',
  'Rejeitada',
  'Finalizada',
]

const TOM_PRIORIDADE: Record<Prioridade, 'danger' | 'neutral' | 'info'> = {
  Alta: 'danger',
  Normal: 'neutral',
  Baixa: 'info',
}

export function SolicitacoesPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { solicitacoes, enviar, decidir, finalizar } = useSolicitacoesStore()
  const notificar = useUiStore((s) => s.notificar)
  const podeCriar = podeCriarSolicitacao(usuario?.perfil ?? 'Visualizador')

  const [aba, setAba] = useState<Aba>('Todas')
  const [modalForm, setModalForm] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Solicitacao | null>(null)
  const [detalhe, setDetalhe] = useState<Solicitacao | null>(null)
  const [linkEnvio, setLinkEnvio] = useState<{ id: string; link: string } | null>(null)
  const [paraRejeitar, setParaRejeitar] = useState<Solicitacao | null>(null)
  const [motivo, setMotivo] = useState('')
  const { ord, ordenar } = useOrdenacao('id')

  const lista = solicitacoes.filter((s) => aba === 'Todas' || s.status === aba)
  const contar = (status: Aba) =>
    status === 'Todas'
      ? solicitacoes.length
      : solicitacoes.filter((s) => s.status === status).length

  const ordenados = ordenarPor(lista, ord)
  const pag = usePaginacao(ordenados.length)
  const visiveis = ordenados.slice(pag.inicio, pag.fim)

  function aoEnviar(id: string) {
    const resultado = enviar(id)
    if (!resultado.ok) {
      notificar('erro', resultado.erro ?? 'Não foi possível enviar')
      return
    }
    const sol = useSolicitacoesStore.getState().solicitacoes.find((s) => s.id === id)
    if (sol?.token) {
      setLinkEnvio({ id, link: montarLinkAprovacao(sol.token) })
    }
    notificar('sucesso', `${id} enviada para aprovação.`)
  }

  function aoDecidir(sol: Solicitacao, acao: 'aprovar' | 'rejeitar', texto?: string) {
    const resultado = decidir(sol.id, acao, texto)
    if (!resultado.ok) {
      notificar('erro', resultado.erro ?? 'Não foi possível processar')
      return
    }
    notificar(
      'sucesso',
      acao === 'aprovar' ? `${sol.id} aprovada.` : `${sol.id} rejeitada.`,
    )
    setParaRejeitar(null)
    setMotivo('')
  }

  async function copiarLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      notificar('info', 'Link copiado para a área de transferência.')
    } catch {
      notificar('erro', 'Não foi possível copiar automaticamente.')
    }
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          podeCriar ? (
            <Botao
              onClick={() => {
                setEmEdicao(null)
                setModalForm(true)
              }}
            >
              <Plus size={16} /> Nova solicitação
            </Botao>
          ) : null
        }
      >
        Solicitações
      </TituloSecao>

      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              aba === a
                ? 'bg-primary text-white'
                : 'border border-line bg-surface text-content-muted hover:text-content'
            }`}
          >
            {a === 'Todas' ? 'Todas' : a}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                aba === a ? 'bg-white/25' : 'bg-surface-3'
              }`}
            >
              {contar(a)}
            </span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma solicitação nesta aba"
          mensagem="Crie uma nova solicitação ou escolha outra aba."
          acao={
            podeCriar ? (
              <Botao
                tamanho="sm"
                onClick={() => {
                  setEmEdicao(null)
                  setModalForm(true)
                }}
              >
                <Plus size={14} /> Nova solicitação
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={[
              'ID',
              'Tipo',
              'Descrição',
              'Prioridade',
              'Solicitante',
              'Status',
              'Ações',
            ]}
            chaves={[
              'id',
              'tipo',
              'descricao',
              'prioridade',
              'solicitante',
              'status',
              null,
            ]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((s) => (
              <Linha key={s.id}>
                <Celula className="whitespace-nowrap font-mono text-xs font-semibold">
                  {s.id}
                </Celula>
                <Celula className="text-xs">{s.tipo}</Celula>
                <Celula className="max-w-xs">
                  <button
                    onClick={() => setDetalhe(s)}
                    className="line-clamp-2 text-left text-sm hover:text-primary"
                    title="Ver detalhes"
                  >
                    {s.descricao}
                  </button>
                </Celula>
                <Celula>
                  <Badge tom={TOM_PRIORIDADE[s.prioridade]}>{s.prioridade}</Badge>
                </Celula>
                <Celula className="text-xs">{s.solicitante}</Celula>
                <Celula>
                  <BadgeStatus status={s.status} />
                </Celula>
                <Celula>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDetalhe(s)}
                      className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-content"
                      title="Detalhes"
                    >
                      <ClipboardList size={16} />
                    </button>
                    {podeCriar && s.status === 'Rascunho' && (
                      <>
                        <button
                          onClick={() => {
                            setEmEdicao(s)
                            setModalForm(true)
                          }}
                          className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-primary"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <Botao tamanho="sm" onClick={() => aoEnviar(s.id)}>
                          <Send size={13} /> Enviar
                        </Botao>
                      </>
                    )}
                    {s.status === 'Enviada' && s.token && (
                      <button
                        onClick={() =>
                          setLinkEnvio({ id: s.id, link: montarLinkAprovacao(s.token!) })
                        }
                        className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-primary"
                        title="Ver link de aprovação"
                      >
                        <Link2 size={16} />
                      </button>
                    )}
                    {s.status === 'Enviada' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => aoDecidir(s, 'aprovar')}
                          className="rounded-lg p-1.5 text-content-muted hover:bg-success/15 hover:text-success"
                          title="Aprovar"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setParaRejeitar(s)
                            setMotivo('')
                          }}
                          className="rounded-lg p-1.5 text-content-muted hover:bg-danger/15 hover:text-danger"
                          title="Rejeitar"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    {s.status === 'Aprovada' && (
                      <Botao tamanho="sm" variante="secundario" onClick={() => finalizar(s.id)}>
                        Finalizar
                      </Botao>
                    )}
                  </div>
                </Celula>
              </Linha>
            ))}
          </tbody>
        </Tabela>
      )}

      {lista.length > 0 && (
        <Paginacao
          pagina={pag.pagina}
          totalPaginas={pag.totalPaginas}
          totalItens={lista.length}
          exibindoDe={pag.inicio + 1}
          exibindoAte={pag.fim}
          aoMudar={pag.setPagina}
        />
      )}

      <SolicitacaoFormModal
        aberto={modalForm}
        aoFechar={() => setModalForm(false)}
        solicitacao={emEdicao}
      />

      <Modal
        aberto={!!linkEnvio}
        aoFechar={() => setLinkEnvio(null)}
        titulo={`Link de aprovação — ${linkEnvio?.id ?? ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setLinkEnvio(null)}>
              Fechar
            </Botao>
            <Botao onClick={() => linkEnvio && copiarLink(linkEnvio.link)}>
              <Copy size={15} /> Copiar link
            </Botao>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-content-muted">
            Em produção este link seria enviado por e-mail ao aprovador. Ele expira em{' '}
            <strong>7 dias</strong> e só pode ser usado uma vez por decisão.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <Link2 size={15} className="shrink-0 text-primary" />
            <code className="truncate text-xs text-content">{linkEnvio?.link}</code>
          </div>
        </div>
      </Modal>

      <Modal
        aberto={!!paraRejeitar}
        aoFechar={() => {
          setParaRejeitar(null)
          setMotivo('')
        }}
        titulo={`Rejeitar ${paraRejeitar?.id ?? ''}`}
        rodape={
          <>
            <Botao
              variante="secundario"
              onClick={() => {
                setParaRejeitar(null)
                setMotivo('')
              }}
            >
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              disabled={motivo.trim().length === 0}
              onClick={() => paraRejeitar && aoDecidir(paraRejeitar, 'rejeitar', motivo)}
            >
              Rejeitar
            </Botao>
          </>
        }
      >
        <AreaTexto
          label="Motivo da rejeição *"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Explique o motivo para o solicitante…"
        />
        <p className="mt-2 text-xs text-content-muted">
          Obrigatório: informe um motivo para prosseguir.
        </p>
      </Modal>

      <Modal
        aberto={!!detalhe}
        aoFechar={() => setDetalhe(null)}
        titulo={detalhe?.id ?? ''}
        largo
        rodape={
          <Botao variante="secundario" onClick={() => setDetalhe(null)}>
            Fechar
          </Botao>
        }
      >
        {detalhe && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <ItemDetalhe rotulo="Status">
              <BadgeStatus status={detalhe.status} />
            </ItemDetalhe>
            <ItemDetalhe rotulo="Prioridade">
              <Badge tom={TOM_PRIORIDADE[detalhe.prioridade]}>{detalhe.prioridade}</Badge>
            </ItemDetalhe>
            <ItemDetalhe rotulo="Tipo">{detalhe.tipo}</ItemDetalhe>
            <ItemDetalhe rotulo="Data">{detalhe.data}</ItemDetalhe>
            <ItemDetalhe rotulo="Solicitante">{detalhe.solicitante}</ItemDetalhe>
            <ItemDetalhe rotulo="Aprovador">{detalhe.aprovador}</ItemDetalhe>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-content-muted">Descrição</dt>
              <dd className="mt-1 text-content">{detalhe.descricao}</dd>
            </div>
            {detalhe.motivoRejeicao && (
              <div className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
                <dt className="text-xs font-medium text-danger">Motivo da rejeição</dt>
                <dd className="mt-1 text-sm text-content">{detalhe.motivoRejeicao}</dd>
              </div>
            )}
            {detalhe.dataAprovacao && (
              <ItemDetalhe rotulo="Decidida em">{detalhe.dataAprovacao}</ItemDetalhe>
            )}
            {detalhe.dataFinalizacao && (
              <ItemDetalhe rotulo="Finalizada em">{detalhe.dataFinalizacao}</ItemDetalhe>
            )}
            {detalhe.notasInternas && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-content-muted">
                  Notas internas
                </dt>
                <dd className="mt-1 text-content">{detalhe.notasInternas}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  )
}

function ItemDetalhe({
  rotulo,
  children,
}: {
  rotulo: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-content-muted">{rotulo}</dt>
      <dd className="mt-0.5 text-content">{children}</dd>
    </div>
  )
}
