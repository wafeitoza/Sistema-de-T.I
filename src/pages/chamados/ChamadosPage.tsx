import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Inbox,
  LifeBuoy,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  X,
} from 'lucide-react'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Entrada } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Paginacao } from '../../components/ui/Paginacao'
import { Resumo } from '../../components/ui/Resumo'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { tomPrioridade } from '../../components/ui/tom'
import { lerColecao } from '../../data/repository'
import { formatarData } from '../../lib/format'
import {
  conectarGmail,
  definirFiltroGmail,
  sincronizarGmail,
  statusGmail,
  type StatusGmail,
} from '../../lib/gmail'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAuthStore } from '../../store/auth'
import {
  perfilOperaChamados,
  PRIORIDADES_CHAMADO,
  STATUS_CHAMADO,
  useChamadosStore,
} from '../../store/chamados'
import { useUiStore } from '../../store/ui'
import type { Chamado, PrioridadeChamado, StatusChamado, Usuario } from '../../types'
import { ChamadoDetalheModal } from './ChamadoDetalheModal'
import { ChamadoFormModal } from './ChamadoFormModal'

const FILTROS = ['Aberto', 'Em atendimento', 'Aguardando usuário', 'Resolvido', 'Cancelado'] as const

// Pills compactos da barra de ação em lote (estilo caixa de e-mail).
const CLASSE_ACAO =
  'rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-content hover:bg-surface-2 focus:border-primary focus:outline-none'

const AVISOS_URL: Record<string, { tom: 'sucesso' | 'erro' | 'info'; texto: string }> = {
  conectado: { tom: 'sucesso', texto: 'Caixa de e-mail conectada. Rode a sincronização para importar.' },
  cancelado: { tom: 'info', texto: 'Autorização cancelada — nenhuma caixa foi conectada.' },
  erro: { tom: 'erro', texto: 'Não foi possível concluir a autorização do Gmail.' },
}

export function ChamadosPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { chamados } = useChamadosStore()
  const notificar = useUiStore((s) => s.notificar)
  const operar = perfilOperaChamados(usuario?.perfil)

  // Quem pode receber chamado em lote (mesmo recorte do modal de novo chamado).
  const atendentes = lerColecao<Usuario>('USUARIOS')
    .filter((u) => u.status === 'Ativo' && u.perfil !== 'Visualizador')
    .map((u) => ({ valor: u.email, rotulo: `${u.nome} (${u.perfil})` }))

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [aberto, setAberto] = useState<Chamado | null>(null)
  const [modalNovo, setModalNovo] = useState(false)
  // Seleção múltipla estilo caixa de e-mail: ids marcados, a barra de ações
  // mostra o total e age sobre todos de uma vez.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const checkCabecalho = useRef<HTMLInputElement>(null)

  const [gmail, setGmail] = useState<StatusGmail | null>(null)
  const [filtroGmail, setFiltroGmail] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
  const [integracoesAbertas, setIntegracoesAbertas] = useState(false)
  const [parametros, setParametros] = useSearchParams()
  const { ord, ordenar } = useOrdenacao('criadoEm', 'desc')

  // O OAuth redireciona para /chamados?gmail=... — traduz o resultado em aviso
  useEffect(() => {
    const resultado = parametros.get('gmail')
    if (!resultado) return
    const aviso = AVISOS_URL[resultado]
    if (aviso) notificar(aviso.tom, aviso.texto)
    const limpo = new URLSearchParams(parametros)
    limpo.delete('gmail')
    setParametros(limpo, { replace: true })
  }, [parametros, setParametros, notificar])

  useEffect(() => {
    let vivo = true
    void statusGmail().then((s) => {
      if (vivo) {
        setGmail(s)
        setFiltroGmail(s.filtro ?? '')
      }
    })
    return () => {
      vivo = false
    }
  }, [])

  async function aoSincronizar() {
    setSincronizando(true)
    const r = await sincronizarGmail()
    setSincronizando(false)
    if (!r.ok) {
      notificar('erro', r.erro ?? 'Não foi possível sincronizar.')
      return
    }
    const d = r.dados ?? {}
    notificar(
      d.chamadosCriados ? 'sucesso' : 'info',
      `Sincronização: ${d.chamadosCriados ?? 0} chamado(s) novo(s), ${d.mensagensAnexadas ?? 0} mensagem(ns) anexada(s).`,
    )
    useChamadosStore.getState().recarregar()
  }

  async function aoConectar() {
    const r = await conectarGmail()
    if (!r.ok) notificar('erro', r.erro ?? 'Não foi possível iniciar a autorização.')
  }

  async function aoSalvarFiltro() {
    const r = await definirFiltroGmail(filtroGmail)
    if (!r.ok) {
      notificar('erro', r.erro ?? 'Não foi possível salvar o filtro.')
      return
    }
    notificar('sucesso', 'Filtro de sincronização salvo.')
    setGmail((s) => (s ? { ...s, filtro: filtroGmail } : s))
  }

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return chamados.filter((c) => {
      const alvo = `${c.id} ${c.assunto} ${c.solicitante} ${c.atribuidoA ?? ''} ${c.descricao ?? ''}`.toLowerCase()
      if (t && !alvo.includes(t)) return false
      return !filtro || c.status === filtro
    })
  }, [chamados, busca, filtro])

  const pag = usePaginacao(lista.length)
  const visiveis = useMemo(
    () => ordenarPor(lista, ord).slice(pag.inicio, pag.fim),
    [lista, ord, pag.inicio, pag.fim],
  )

  // ── Seleção múltipla ──────────────────────────────────────────────────────
  // A seleção sobrevive a paginação e filtro; a barra de ações sempre mostra
  // o total marcado, então nada muda fora da vista sem o usuário saber.
  const visiveisSelecionados = visiveis.filter((c) => selecionados.has(c.id)).length
  const todosVisiveis = visiveis.length > 0 && visiveisSelecionados === visiveis.length
  const algunsVisiveis = visiveisSelecionados > 0 && !todosVisiveis

  useEffect(() => {
    if (checkCabecalho.current) checkCabecalho.current.indeterminate = algunsVisiveis
  }, [algunsVisiveis])

  function alternar(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  function alternarTodosVisiveis() {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      for (const c of visiveis) {
        if (todosVisiveis) proximo.delete(c.id)
        else proximo.add(c.id)
      }
      return proximo
    })
  }

  function selecionarTodosFiltrados() {
    setSelecionados(new Set(lista.map((c) => c.id)))
  }

  function limparSelecao() {
    setSelecionados(new Set())
  }

  /**
   * Aplica uma ação da barra em todos os marcados. Falha individual nunca
   * fica em silêncio: vira aviso com o motivo (mesmo critério do modal).
   */
  function aplicarEmLote(
    ids: string[],
    executar: (id: string) => { ok: boolean; erro?: string },
    sucesso: (n: number) => string,
  ) {
    let feitos = 0
    const motivos = new Map<string, number>()
    for (const id of ids) {
      try {
        const r = executar(id)
        if (r.ok) {
          feitos += 1
        } else {
          const motivo = r.erro ?? 'não foi possível atualizar.'
          motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1)
        }
      } catch (e) {
        console.error('[chamados] falha na alteração em lote:', id, e)
        motivos.set('erro inesperado', (motivos.get('erro inesperado') ?? 0) + 1)
      }
    }

    const pulados = ids.length - feitos
    if (feitos === 0) {
      const primeiro = [...motivos.keys()][0] ?? 'Tente novamente.'
      notificar('erro', `Nenhum chamado atualizado. ${primeiro}`)
      return
    }
    if (pulados === 0) {
      notificar('sucesso', sucesso(feitos))
      return
    }
    const resumo = [...motivos]
      .slice(0, 2)
      .map(([m, q]) => (q > 1 ? `${q}× ${m}` : m))
      .join(' · ')
    notificar('info', `${sucesso(feitos)} ${pulados} não puderam: ${resumo}`)
  }

  function mudarStatusEmLote(status: StatusChamado) {
    aplicarEmLote(
      [...selecionados],
      (id) => useChamadosStore.getState().mudarStatus(id, status),
      (n) => `Status "${status}" aplicado a ${n} chamado(s).`,
    )
  }

  function atribuirEmLote(email: string) {
    aplicarEmLote(
      [...selecionados],
      (id) => useChamadosStore.getState().atribuir(id, email),
      (n) => `${n} chamado(s) atribuído(s) a ${email}.`,
    )
  }

  function mudarPrioridadeEmLote(prioridade: PrioridadeChamado) {
    aplicarEmLote(
      [...selecionados],
      (id) => useChamadosStore.getState().mudarPrioridade(id, prioridade),
      (n) => `Prioridade "${prioridade}" aplicada a ${n} chamado(s).`,
    )
  }

  const abertos = chamados.filter((c) => c.status === 'Aberto')
  const emAtendimento = chamados.filter((c) => c.status === 'Em atendimento')
  const aguardando = chamados.filter((c) => c.status === 'Aguardando usuário')
  const resolvidos = chamados.filter((c) => c.status === 'Resolvido')

  const resumos = [
    { titulo: 'Abertos', curto: 'Abertos', valor: abertos.length, destaque: abertos.length > 0, icone: <Inbox size={16} /> },
    { titulo: 'Em atendimento', curto: 'Em atend.', valor: emAtendimento.length, destaque: false, icone: <LifeBuoy size={16} /> },
    { titulo: 'Aguardando usuário', curto: 'Aguard.', valor: aguardando.length, destaque: false, icone: <Mail size={16} /> },
    { titulo: 'Resolvidos', curto: 'Resolvidos', valor: resolvidos.length, destaque: false, icone: <CheckCircle2 size={16} /> },
  ]

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          operar ? (
            <Botao onClick={() => setModalNovo(true)}>
              <Plus size={16} /> Novo chamado
            </Botao>
          ) : null
        }
      >
        Chamados
      </TituloSecao>

      {/* Celular: faixa compacta em uma linha */}
      <div className="grid grid-cols-4 gap-2 sm:hidden">
        {resumos.map((r) => (
          <div key={r.titulo} className="rounded-lg border border-line bg-card px-2 py-2 text-center">
            <p
              className={`num text-lg font-extrabold leading-none ${
                r.destaque ? 'text-danger' : 'text-content'
              }`}
            >
              {r.valor}
            </p>
            <p className="mt-1 truncate text-[10px] font-medium text-content-muted">{r.curto}</p>
          </div>
        ))}
      </div>

      {/* Telas maiores: cards completos */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {resumos.map((r) => (
          <Resumo
            key={r.titulo}
            titulo={r.titulo}
            valor={r.valor}
            destaque={r.destaque}
            icone={r.icone}
          />
        ))}
      </div>

      {operar && (
        <section className="rounded-xl border border-line bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 size={15} /> Integração com o Gmail
              </h3>
              <p className="mt-0.5 truncate text-xs text-content-muted">
                {gmail?.conectado
                  ? `Conectado como ${gmail.conta}${
                      gmail.ultimaSincronizacao
                        ? ` · última sincronização ${formatarData(gmail.ultimaSincronizacao)}`
                        : ''
                    }`
                  : 'Nenhuma caixa conectada. Os chamados podem ser abertos na tela normalmente.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!gmail?.conectado ? (
                <Botao tamanho="sm" onClick={aoConectar}>
                  <Mail size={14} /> Conectar Gmail
                </Botao>
              ) : (
                <Botao tamanho="sm" disabled={sincronizando} onClick={aoSincronizar}>
                  <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
                  {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
                </Botao>
              )}
              <button
                type="button"
                onClick={() => setIntegracoesAbertas((v) => !v)}
                aria-expanded={integracoesAbertas}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
              >
                {integracoesAbertas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {integracoesAbertas ? 'Ocultar' : 'Configurar'}
              </button>
            </div>
          </div>

          {integracoesAbertas && (
            <div className="border-t border-line px-4 pb-4 pt-3">
              {gmail?.conectado && (
                <div className="flex flex-wrap items-end gap-2">
                  <Entrada
                    label="O que vira chamado (consulta do Gmail)"
                    className="min-w-64 flex-1"
                    value={filtroGmail}
                    onChange={(e) => setFiltroGmail(e.target.value)}
                    placeholder="in:inbox newer_than:7d"
                  />
                  <Botao tamanho="sm" variante="secundario" onClick={aoSalvarFiltro}>
                    Salvar filtro
                  </Botao>
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs text-content-muted hover:bg-surface-2"
                  >
                    <ExternalLink size={12} /> Gerenciar acesso
                  </a>
                </div>
              )}

              <p className="mt-2 text-xs text-content-muted">
                Sem filtro, a sincronização importaria tudo o que chega na caixa — inclusive
                newsletters e cobranças. Use a consulta do Gmail para limitar (ex.:{' '}
                <code className="rounded bg-surface-3 px-1">to:ti@empresa.com</code> ou{' '}
                <code className="rounded bg-surface-3 px-1">label:Chamados</code>).
              </p>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por assunto, solicitante, responsável ou ID…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          onClick={() => setFiltro('')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            filtro === '' ? 'bg-surface-3 text-content' : 'border border-line bg-surface text-content-muted'
          }`}
        >
          Todos
        </button>
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === f ? 'bg-surface-3 text-content' : 'border border-line bg-surface text-content-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Barra de ação em lote — só aparece com seleção ativa (estilo e-mail). */}
      {operar && selecionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-card px-3 py-2">
          <span className="text-sm font-semibold">{selecionados.size} selecionado(s)</span>
          {todosVisiveis && lista.length > selecionados.size && (
            <button
              type="button"
              onClick={selecionarTodosFiltrados}
              className="text-xs font-medium text-primary hover:underline"
            >
              Selecionar todos os {lista.length} da lista
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <select
              value=""
              onChange={(e) => e.target.value && mudarStatusEmLote(e.target.value as StatusChamado)}
              aria-label="Mudar o status dos chamados selecionados"
              className={CLASSE_ACAO}
            >
              <option value="">Mudar status…</option>
              {STATUS_CHAMADO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {atendentes.length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && atribuirEmLote(e.target.value)}
                aria-label="Atribuir os chamados selecionados a…"
                className={CLASSE_ACAO}
              >
                <option value="">Atribuir a…</option>
                {atendentes.map((a) => (
                  <option key={a.valor} value={a.valor}>
                    {a.rotulo}
                  </option>
                ))}
              </select>
            )}
            <select
              value=""
              onChange={(e) =>
                e.target.value && mudarPrioridadeEmLote(e.target.value as PrioridadeChamado)
              }
              aria-label="Mudar a prioridade dos chamados selecionados"
              className={CLASSE_ACAO}
            >
              <option value="">Mudar prioridade…</option>
              {PRIORIDADES_CHAMADO.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={limparSelecao}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-content-muted hover:bg-surface-2 hover:text-content"
            >
              <X size={13} /> Limpar
            </button>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum chamado"
          mensagem={
            chamados.length
              ? 'Nenhum chamado corresponde aos filtros aplicados.'
              : 'Abra um chamado manualmente ou conecte a caixa de e-mail para importar o que chega.'
          }
          acao={
            operar && !chamados.length ? (
              <Botao tamanho="sm" onClick={() => setModalNovo(true)}>
                <Plus size={14} /> Novo chamado
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela className="table-fixed">
          <CabecalhoTabela
            antesColunas={
              operar ? (
                <input
                  ref={checkCabecalho}
                  type="checkbox"
                  checked={todosVisiveis}
                  onChange={alternarTodosVisiveis}
                  aria-label="Selecionar todos os chamados da página"
                  className="h-4 w-4 accent-primary align-middle"
                />
              ) : undefined
            }
            colunas={['ID', 'Assunto', 'Solicitante', 'Prioridade', 'Responsável', 'Aberto em', 'Status', '']}
            chaves={['id', 'assunto', 'solicitante', 'prioridade', 'atribuidoA', 'criadoEm', 'status', null]}
            classes={[
              'hidden w-40 md:table-cell',
              'w-auto',
              'hidden w-44 2xl:table-cell',
              'hidden w-28 sm:table-cell',
              'hidden w-44 lg:table-cell',
              'hidden w-28 xl:table-cell',
              'w-44',
              'w-16',
            ]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((c) => (
              <Linha
                key={c.id}
                onClick={() => setAberto(c)}
                className={selecionados.has(c.id) ? 'bg-primary/5' : undefined}
              >
                {operar && (
                  <Celula className="w-12">
                    <input
                      type="checkbox"
                      checked={selecionados.has(c.id)}
                      onChange={() => alternar(c.id)}
                      // A linha inteira abre o detalhe; o checkbox só marca.
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Selecionar o chamado ${c.id}`}
                      className="h-4 w-4 accent-primary"
                    />
                  </Celula>
                )}
                <Celula className="hidden whitespace-nowrap font-mono text-xs font-semibold md:table-cell">
                  {c.id}
                </Celula>
                <Celula>
                  <p className="truncate text-sm font-medium" title={c.assunto}>
                    {c.assunto}
                  </p>
                  <p className="truncate text-xs text-content-muted">
                    <span className="2xl:hidden">{c.solicitante}</span>
                    {c.origem === 'E-mail' && (
                      <span>
                        <span className="2xl:hidden"> · </span>
                        veio do e-mail
                      </span>
                    )}
                  </p>
                </Celula>
                <Celula className="hidden text-sm 2xl:table-cell">
                  <span className="block truncate" title={c.solicitante}>
                    {c.solicitante}
                  </span>
                </Celula>
                <Celula className="hidden sm:table-cell">
                  <Badge tom={tomPrioridade(c.prioridade)}>{c.prioridade}</Badge>
                </Celula>
                <Celula className="hidden text-sm lg:table-cell">
                  <span className="block truncate" title={c.atribuidoA ?? ''}>
                    {c.atribuidoA ?? '—'}
                  </span>
                </Celula>
                <Celula className="hidden whitespace-nowrap text-sm xl:table-cell">
                  {formatarData(c.criadoEm)}
                </Celula>
                <Celula>
                  <BadgeStatus status={c.status} />
                </Celula>
                <Celula className="text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAberto(c)
                    }}
                    aria-label={`Abrir o chamado ${c.id}`}
                    className="rounded-full p-1.5 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
                  >
                    <ChevronRight size={16} />
                  </button>
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

      <ChamadoDetalheModal chamado={aberto} perfil={usuario?.perfil} aoFechar={() => setAberto(null)} />
      <ChamadoFormModal
        aberto={modalNovo}
        aoFechar={() => setModalNovo(false)}
        aoCriar={() => {
          // Limpa busca/filtro: com filtro ativo (ex.: "Resolvido") o chamado
          // novo é criado mas não aparece na lista, e parece que não funcionou.
          setBusca('')
          setFiltro('')
        }}
      />
    </div>
  )
}
