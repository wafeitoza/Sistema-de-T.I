import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  LifeBuoy,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Entrada } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Paginacao } from '../../components/ui/Paginacao'
import { Resumo } from '../../components/ui/Resumo'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
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
import { perfilOperaChamados, useChamadosStore } from '../../store/chamados'
import { useUiStore } from '../../store/ui'
import type { Chamado } from '../../types'
import { ChamadoDetalheModal } from './ChamadoDetalheModal'
import { ChamadoFormModal } from './ChamadoFormModal'

const FILTROS = ['Aberto', 'Em atendimento', 'Aguardando usuário', 'Resolvido', 'Cancelado'] as const

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

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [aberto, setAberto] = useState<Chamado | null>(null)
  const [modalNovo, setModalNovo] = useState(false)

  const [gmail, setGmail] = useState<StatusGmail | null>(null)
  const [filtroGmail, setFiltroGmail] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
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

  const abertos = chamados.filter((c) => c.status === 'Aberto')
  const emAtendimento = chamados.filter((c) => c.status === 'Em atendimento')
  const aguardando = chamados.filter((c) => c.status === 'Aguardando usuário')
  const resolvidos = chamados.filter((c) => c.status === 'Resolvido')

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Abertos" valor={abertos.length} destaque={abertos.length > 0} icone={<Inbox size={16} />} />
        <Resumo titulo="Em atendimento" valor={emAtendimento.length} icone={<LifeBuoy size={16} />} />
        <Resumo titulo="Aguardando usuário" valor={aguardando.length} icone={<Mail size={16} />} />
        <Resumo titulo="Resolvidos" valor={resolvidos.length} icone={<CheckCircle2 size={16} />} />
      </div>

      {operar && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 size={15} /> Integração com o Gmail
              </h3>
              <p className="mt-0.5 text-xs text-content-muted">
                {gmail?.conectado
                  ? `Conectado como ${gmail.conta}${
                      gmail.ultimaSincronizacao
                        ? ` · última sincronização ${formatarData(gmail.ultimaSincronizacao)}`
                        : ''
                    }`
                  : 'Nenhuma caixa conectada. Os chamados podem ser abertos na tela normalmente.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!gmail?.conectado ? (
                <Botao tamanho="sm" onClick={aoConectar}>
                  <Mail size={14} /> Conectar Gmail
                </Botao>
              ) : (
                <>
                  <Botao tamanho="sm" disabled={sincronizando} onClick={aoSincronizar}>
                    <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
                    {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
                  </Botao>
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs text-content-muted hover:bg-surface-2"
                  >
                    <ExternalLink size={12} /> Gerenciar acesso
                  </a>
                </>
              )}
            </div>
          </div>

          {gmail?.conectado && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
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
            </div>
          )}

          <p className="mt-2 text-xs text-content-muted">
            Sem filtro, a sincronização importaria tudo o que chega na caixa — inclusive newsletters
            e cobranças. Use a consulta do Gmail para limitar (ex.:{' '}
            <code className="rounded bg-surface-3 px-1">to:ti@empresa.com</code> ou{' '}
            <code className="rounded bg-surface-3 px-1">label:Chamados</code>).
          </p>
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
            filtro === '' ? 'bg-primary text-white' : 'border border-line bg-surface text-content-muted'
          }`}
        >
          Todos
        </button>
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === f ? 'bg-primary text-white' : 'border border-line bg-surface text-content-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

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
        <Tabela>
          <CabecalhoTabela
            colunas={['ID', 'Assunto', 'Solicitante', 'Prioridade', 'Responsável', 'Aberto em', 'Status', '']}
            chaves={['id', 'assunto', 'solicitante', 'prioridade', 'atribuidoA', 'criadoEm', 'status', null]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((c) => (
              <Linha key={c.id}>
                <Celula className="whitespace-nowrap font-mono text-xs font-semibold">{c.id}</Celula>
                <Celula>
                  <p className="text-sm font-medium">{c.assunto}</p>
                  {c.origem === 'E-mail' && (
                    <p className="text-xs text-content-muted">veio do e-mail</p>
                  )}
                </Celula>
                <Celula className="text-sm">{c.solicitante}</Celula>
                <Celula>
                  <Badge
                    tom={
                      c.prioridade === 'Crítica'
                        ? 'danger'
                        : c.prioridade === 'Alta'
                          ? 'warning'
                          : c.prioridade === 'Média'
                            ? 'info'
                            : 'neutral'
                    }
                  >
                    {c.prioridade}
                  </Badge>
                </Celula>
                <Celula className="text-sm">{c.atribuidoA ?? '—'}</Celula>
                <Celula className="whitespace-nowrap text-sm">{formatarData(c.criadoEm)}</Celula>
                <Celula>
                  <BadgeStatus status={c.status} />
                </Celula>
                <Celula>
                  <Botao tamanho="sm" variante="fantasma" onClick={() => setAberto(c)}>
                    Abrir
                  </Botao>
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
      <ChamadoFormModal aberto={modalNovo} aoFechar={() => setModalNovo(false)} />
    </div>
  )
}
