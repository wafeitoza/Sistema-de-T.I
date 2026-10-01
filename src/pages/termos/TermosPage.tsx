import { useMemo, useState } from 'react'
import {
  Ban,
  ClipboardList,
  Copy,
  FileSignature,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Selecao } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Paginacao } from '../../components/ui/Paginacao'
import { Resumo } from '../../components/ui/Resumo'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { formatarData } from '../../lib/format'
import { integridadeOK } from '../../lib/termos'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAuthStore } from '../../store/auth'
import { useTermosStore } from '../../store/termos'
import { useUiStore } from '../../store/ui'
import type { StatusTermo, Termo } from '../../types'
import { TermoFormModal } from './TermoFormModal'

const TOM_STATUS: Record<StatusTermo, 'warning' | 'success' | 'neutral'> = {
  Pendente: 'warning',
  Assinado: 'success',
  Revogado: 'neutral',
}

const STATUS_OPCOES: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos os status' },
  { valor: 'Pendente', rotulo: 'Pendente' },
  { valor: 'Assinado', rotulo: 'Assinado' },
  { valor: 'Revogado', rotulo: 'Revogado' },
]

export function TermosPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { termos, assinar, revogar } = useTermosStore()
  const notificar = useUiStore((s) => s.notificar)
  const podeRevogar = usuario?.perfil === 'Admin' || usuario?.perfil === 'Gerente'

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalForm, setModalForm] = useState(false)
  const [detalhe, setDetalhe] = useState<Termo | null>(null)
  const [paraAssinar, setParaAssinar] = useState<Termo | null>(null)
  const [paraRevogar, setParaRevogar] = useState<Termo | null>(null)
  const [verificando, setVerificando] = useState<string | null>(null)
  const { ord, ordenar } = useOrdenacao('criadoEm')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return termos.filter((t) => {
      if (filtroStatus && t.status !== filtroStatus) return false
      if (!termo) return true
      return (
        t.id.toLowerCase().includes(termo) ||
        t.ativoCodigo.toLowerCase().includes(termo) ||
        t.responsavel.toLowerCase().includes(termo)
      )
    })
  }, [termos, busca, filtroStatus])

  const ordenados = ordenarPor(filtrados, ord)
  const pag = usePaginacao(ordenados.length)
  const visiveis = ordenados.slice(pag.inicio, pag.fim)

  const contar = (status: StatusTermo) => termos.filter((t) => t.status === status).length

  async function revalidar(t: Termo) {
    if (verificando) return
    setVerificando(t.id)
    const ok = await integridadeOK(t)
    setVerificando(null)
    if (ok) {
      notificar('sucesso', `${t.id}: hash íntegro — SHA-256 confere.`)
    } else {
      notificar('erro', `${t.id}: hash divergente — registro possivelmente adulterado.`)
    }
  }

  async function copiarHash(t: Termo) {
    try {
      await navigator.clipboard.writeText(t.hash)
      notificar('info', 'Hash SHA-256 copiado.')
    } catch {
      notificar('erro', 'Não foi possível copiar o hash.')
    }
  }

  function confirmarAssinatura() {
    if (!paraAssinar) return
    assinar(paraAssinar.id)
    notificar('sucesso', `${paraAssinar.id} assinado e registrado como Assinado.`)
    setParaAssinar(null)
    setDetalhe(null)
  }

  function confirmarRevogacao() {
    if (!paraRevogar) return
    revogar(paraRevogar.id)
    notificar('sucesso', `${paraRevogar.id} revogado.`)
    setParaRevogar(null)
    setDetalhe(null)
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          <Botao
            onClick={() => setModalForm(true)}
          >
            <Plus size={16} /> Novo termo
          </Botao>
        }
      >
        Termos de responsabilidade
      </TituloSecao>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo
          titulo="Total de termos"
          valor={termos.length}
          icone={<FileSignature size={16} className="text-primary" />}
        />
        <Resumo
          titulo="Pendentes"
          valor={contar('Pendente')}
          destaque={contar('Pendente') > 0}
          icone={<PenLine size={16} className="text-warning" />}
        />
        <Resumo
          titulo="Assinados"
          valor={contar('Assinado')}
          icone={<ShieldCheck size={16} className="text-success" />}
        />
        <Resumo
          titulo="Revogados"
          valor={contar('Revogado')}
          icone={<Ban size={16} className="text-content-muted" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar ID, ativo ou responsável…"
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
          titulo={termos.length === 0 ? 'Nenhum termo criado' : 'Nenhum termo encontrado'}
          mensagem={
            termos.length === 0
              ? 'Crie um termo de responsabilidade para um ativo e registre a assinatura com hash SHA-256.'
              : 'Ajuste a busca ou o filtro de status.'
          }
          acao={
            termos.length === 0 ? (
              <Botao tamanho="sm" onClick={() => setModalForm(true)}>
                <Plus size={14} /> Novo termo
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={['ID', 'Ativo', 'Responsável', 'Status', 'Criado em', 'Hash', 'Ações']}
            chaves={['id', 'ativoCodigo', 'responsavel', 'status', 'criadoEm', null, null]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((t) => (
              <Linha key={t.id}>
                <Celula className="whitespace-nowrap font-mono text-xs font-semibold">
                  {t.id}
                </Celula>
                <Celula className="font-mono text-xs">{t.ativoCodigo}</Celula>
                <Celula className="text-xs">{t.responsavel}</Celula>
                <Celula>
                  <Badge tom={TOM_STATUS[t.status]}>{t.status}</Badge>
                </Celula>
                <Celula className="whitespace-nowrap text-xs text-content-muted">
                  {formatarData(t.criadoEm)}
                </Celula>
                <Celula>
                  <code
                    className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-content-muted"
                    title={t.hash || 'sem hash'}
                  >
                    {t.hash ? `${t.hash.slice(0, 12)}…` : '—'}
                  </code>
                </Celula>
                <Celula>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDetalhe(t)}
                      className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-content"
                      title="Ver detalhes"
                    >
                      <ClipboardList size={16} />
                    </button>
                    <button
                      onClick={() => void revalidar(t)}
                      disabled={verificando === t.id}
                      className="rounded-lg p-1.5 text-content-muted hover:bg-success/15 hover:text-success disabled:opacity-50"
                      title="Revalidar hash"
                    >
                      <ShieldCheck size={16} />
                    </button>
                    {t.status === 'Pendente' && (
                      <button
                        onClick={() => setParaAssinar(t)}
                        className="rounded-lg p-1.5 text-content-muted hover:bg-primary/15 hover:text-primary"
                        title="Assinar"
                      >
                        <PenLine size={16} />
                      </button>
                    )}
                    {t.status === 'Assinado' && podeRevogar && (
                      <button
                        onClick={() => setParaRevogar(t)}
                        className="rounded-lg p-1.5 text-content-muted hover:bg-danger/15 hover:text-danger"
                        title="Revogar"
                      >
                        <Ban size={16} />
                      </button>
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

      <TermoFormModal aberto={modalForm} aoFechar={() => setModalForm(false)} />

      <Modal
        aberto={!!detalhe}
        aoFechar={() => setDetalhe(null)}
        titulo={detalhe?.id ?? ''}
        largo
        rodape={
          <>
            <Botao variante="secundario" onClick={() => detalhe && void revalidar(detalhe)}>
              <ShieldCheck size={15} /> Revalidar
            </Botao>
            <Botao variante="secundario" onClick={() => detalhe && void copiarHash(detalhe)}>
              <Copy size={15} /> Copiar hash
            </Botao>
            <Botao variante="secundario" onClick={() => setDetalhe(null)}>
              Fechar
            </Botao>
          </>
        }
      >
        {detalhe && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-content-muted">Status</dt>
                <dd className="mt-1">
                  <Badge tom={TOM_STATUS[detalhe.status]}>{detalhe.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-content-muted">Ativo</dt>
                <dd className="mt-1 font-mono text-xs">{detalhe.ativoCodigo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-content-muted">Responsável</dt>
                <dd className="mt-1">{detalhe.responsavel}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-content-muted">Criado em</dt>
                <dd className="mt-1">{formatarData(detalhe.criadoEm)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-content-muted">Criado por</dt>
                <dd className="mt-1">{detalhe.criadoPor}</dd>
              </div>
              {detalhe.assinadoEm && (
                <div>
                  <dt className="text-xs font-medium text-content-muted">Assinado em</dt>
                  <dd className="mt-1">
                    {formatarData(detalhe.assinadoEm)} por {detalhe.assinadoPor}
                  </dd>
                </div>
              )}
              {detalhe.revogadoEm && (
                <div>
                  <dt className="text-xs font-medium text-content-muted">Revogado em</dt>
                  <dd className="mt-1">
                    {formatarData(detalhe.revogadoEm)} por {detalhe.revogadoPor}
                  </dd>
                </div>
              )}
            </dl>
            <div>
              <p className="text-xs font-medium text-content-muted">Conteúdo</p>
              <pre className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed text-content">
                {detalhe.conteudo}
              </pre>
            </div>
            <div>
              <p className="text-xs font-medium text-content-muted">Hash SHA-256</p>
              <code className="mt-1 block break-all rounded-lg border border-line bg-surface-2 p-2.5 font-mono text-[11px] text-content">
                {detalhe.hash || 'sem hash registrado'}
              </code>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        aberto={!!paraAssinar}
        aoFechar={() => setParaAssinar(null)}
        titulo={`Assinar ${paraAssinar?.id ?? ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaAssinar(null)}>
              Cancelar
            </Botao>
            <Botao onClick={confirmarAssinatura}>Assinar</Botao>
          </>
        }
      >
        <p className="text-sm text-content">
          Confirmar a assinatura do termo do ativo{' '}
          <strong className="font-mono">{paraAssinar?.ativoCodigo}</strong> em nome de{' '}
          <strong>{paraAssinar?.responsavel}</strong>? O status mudará para{' '}
          <strong>Assinado</strong> e o registro ficará na auditoria.
        </p>
      </Modal>

      <Modal
        aberto={!!paraRevogar}
        aoFechar={() => setParaRevogar(null)}
        titulo={`Revogar ${paraRevogar?.id ?? ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaRevogar(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={confirmarRevogacao}>
              Revogar
            </Botao>
          </>
        }
      >
        <p className="text-sm text-content">
          Revogar o termo do ativo <strong className="font-mono">{paraRevogar?.ativoCodigo}</strong>
          ? O termo deixa de ter validade; o hash original é preservado para auditoria.
        </p>
      </Modal>
    </div>
  )
}
