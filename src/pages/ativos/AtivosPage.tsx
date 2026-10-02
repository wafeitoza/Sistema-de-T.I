import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Plus, QrCode, Search, Tags, Trash2 } from 'lucide-react'
import { BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Selecao } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Paginacao } from '../../components/ui/Paginacao'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { TIPOS_ATIVO } from '../../lib/codes'
import { formatarData } from '../../lib/format'
import { podeEditar } from '../../lib/permissions'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAtivosStore } from '../../store/ativos'
import { useSetoresStore } from '../../store/setores'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import type { Ativo, StatusAtivo } from '../../types'
import { AtivoFormModal } from './AtivoFormModal'
import { EtiquetasModal } from './EtiquetasModal'

const STATUS_ATIVO: StatusAtivo[] = ['Ativo', 'Inativo', 'Manutenção', 'Descartado']

export function AtivosPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { ativos, mudarStatus } = useAtivosStore()
  const setoresStore = useSetoresStore((s) => s.setores)
  const notificar = useUiStore((s) => s.notificar)
  const editar = podeEditar(usuario?.perfil ?? 'Visualizador')

  const [params] = useSearchParams()
  const [busca, setBusca] = useState(() => params.get('q') ?? '')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroSetor, setFiltroSetor] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalForm, setModalForm] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Ativo | null>(null)
  const [qrAtivo, setQrAtivo] = useState<Ativo | null>(null)
  const [paraDescartar, setParaDescartar] = useState<Ativo | null>(null)
  const [etiquetas, setEtiquetas] = useState(false)
  const { ord, ordenar } = useOrdenacao('codigo')

  const qDaUrl = params.get('q') ?? ''
  const [qAnterior, setQAnterior] = useState(qDaUrl)
  if (qDaUrl !== qAnterior) {
    setQAnterior(qDaUrl)
    if (qDaUrl) setBusca(qDaUrl)
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return ativos.filter((a) => {
      if (filtroTipo && a.tipo !== filtroTipo) return false
      if (filtroSetor && a.setor !== filtroSetor) return false
      if (filtroStatus && a.status !== filtroStatus) return false
      if (!termo) return true
      return (
        a.codigo.toLowerCase().includes(termo) ||
        a.descricao.toLowerCase().includes(termo) ||
        a.responsavel.toLowerCase().includes(termo) ||
        (a.serial ?? '').toLowerCase().includes(termo) ||
        (a.tombamento ?? '').toLowerCase().includes(termo)
      )
    })
  }, [ativos, busca, filtroTipo, filtroSetor, filtroStatus])

  const pag = usePaginacao(filtrados.length)
  const visiveis = useMemo(
    () => ordenarPor(filtrados, ord).slice(pag.inicio, pag.fim),
    [filtrados, ord, pag.inicio, pag.fim],
  )

  function confirmarDescarte() {
    if (!paraDescartar) return
    mudarStatus(paraDescartar.codigo, 'Descartado')
    notificar('sucesso', `${paraDescartar.codigo} marcado como descartado.`)
    setParaDescartar(null)
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          <div className="flex items-center gap-2">
            <Botao variante="secundario" onClick={() => setEtiquetas(true)}>
              <Tags size={16} /> Etiquetas
            </Botao>
            {editar && (
              <Botao
                onClick={() => {
                  setEmEdicao(null)
                  setModalForm(true)
                }}
              >
                <Plus size={16} /> Novo ativo
              </Botao>
            )}
          </div>
        }
      >
        Ativos
      </TituloSecao>

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
          opcoes={setoresStore
            .filter((s) => s.ativo)
            .map((s) => ({ valor: s.nome, rotulo: s.nome }))}
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

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum ativo encontrado"
          mensagem="Ajuste os filtros ou cadastre um novo ativo."
          acao={
            editar ? (
              <Botao
                tamanho="sm"
                onClick={() => {
                  setEmEdicao(null)
                  setModalForm(true)
                }}
              >
                <Plus size={14} /> Novo ativo
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={[
              'Código',
              'Descrição',
              'Setor',
              'Responsável',
              'Status',
              'Próx. manutenção',
              'Ações',
            ]}
            chaves={[
              'codigo',
              'descricao',
              'setor',
              'responsavel',
              'status',
              'proximaManutencao',
              null,
            ]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((a) => (
              <Linha key={a.codigo}>
                <Celula className="font-mono text-xs font-semibold">{a.codigo}</Celula>
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
                <Celula className="text-xs text-content-muted">
                  {a.proximaManutencao ? formatarData(a.proximaManutencao) : '—'}
                </Celula>
                <Celula>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQrAtivo(a)}
                      className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-primary"
                      title="Ver QR Code"
                    >
                      <QrCode size={16} />
                    </button>
                    {editar && a.status !== 'Descartado' && (
                      <>
                        <button
                          onClick={() => {
                            setEmEdicao(a)
                            setModalForm(true)
                          }}
                          className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-content"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setParaDescartar(a)}
                          className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-danger"
                          title="Descartar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
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

      <p className="text-xs text-content-muted">
        {filtrados.length} de {ativos.length} ativos exibidos.
      </p>

      <AtivoFormModal
        aberto={modalForm}
        aoFechar={() => setModalForm(false)}
        ativo={emEdicao}
      />

      <Modal
        aberto={!!qrAtivo}
        aoFechar={() => setQrAtivo(null)}
        titulo={`QR Code — ${qrAtivo?.codigo ?? ''}`}
        rodape={
          <Botao variante="secundario" onClick={() => setQrAtivo(null)}>
            Fechar
          </Botao>
        }
      >
        {qrAtivo && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <img
              src={qrAtivo.qrUrl}
              alt={`QR Code de ${qrAtivo.codigo}`}
              className="h-48 w-48 rounded-lg border border-line bg-white p-2"
            />
            <div>
              <p className="text-sm font-semibold text-content">{qrAtivo.descricao}</p>
              <p className="font-mono text-xs text-content-muted">{qrAtivo.codigo}</p>
              {qrAtivo.tombamento && (
                <p className="font-mono text-xs text-primary">
                  Tombamento: {qrAtivo.tombamento}
                </p>
              )}
            </div>
            <a
              href={qrAtivo.qrUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline"
            >
              Abrir imagem em nova aba
            </a>
          </div>
        )}
      </Modal>

      <EtiquetasModal
        aberto={etiquetas}
        aoFechar={() => setEtiquetas(false)}
        ativos={ativos}
      />

      <Modal
        aberto={!!paraDescartar}
        aoFechar={() => setParaDescartar(null)}
        titulo="Descartar ativo"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaDescartar(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={confirmarDescarte}>
              Descartar
            </Botao>
          </>
        }
      >
        <p className="text-sm text-content">
          Confirma a descarta de <strong>{paraDescartar?.codigo}</strong> —{' '}
          {paraDescartar?.descricao}? A ação é irreversível e fica registrada na
          auditoria.
        </p>
      </Modal>
    </div>
  )
}
