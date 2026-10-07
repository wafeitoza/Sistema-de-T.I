import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto } from '../../components/ui/Campos'
import { buscarSolicitacaoPorToken } from '../../data/aprovacao'
import { modoSupabase } from '../../data/client'
import { validarTokenAprovacao } from '../../lib/token'
import { useSolicitacoesStore } from '../../store/solicitacoes'
import { useUiStore } from '../../store/ui'
import type { Solicitacao } from '../../types'

/**
 * RN004 — página pública de aprovação (roda fora do Layout, sem login).
 *
 * No modo Supabase ela não lê tabela nenhuma: o token é um UUID guardado no
 * banco e a leitura/decisão acontecem nas RPCs `solicitacao_por_token` e
 * `decidir_por_token`. No modo local valida contra o espelho do navegador.
 */
type ConsultaRemota =
  | { estado: 'ocioso' }
  | { estado: 'carregando' }
  | { estado: 'erro'; erro: string }
  | { estado: 'ok'; solicitacao: Solicitacao }

export function AprovacaoPage() {
  const { token = '' } = useParams()
  const notificar = useUiStore((s) => s.notificar)
  const decidirPorToken = useSolicitacoesStore((s) => s.decidirPorToken)
  // no modo local a validação é contra o espelho — assinatura durante a
  // renderização, sem efeito
  const solicitacoesLocais = useSolicitacoesStore((s) => s.solicitacoes)

  const validacao = validarTokenAprovacao(token)
  const consulta = modoSupabase && validacao.valido
  // "agora" congelado no mount: renderização fica pura (sem Date.now no corpo)
  const [agora] = useState(() => Date.now())

  const [consultaRemota, setConsultaRemota] = useState<ConsultaRemota>(() =>
    consulta ? { estado: 'carregando' } : { estado: 'ocioso' },
  )
  // o token muda só se a rota mudar sem remontar: ajusta na renderização
  // (mesmo anti-pattern usado nos modais do projeto)
  const [tokenAnterior, setTokenAnterior] = useState(token)
  if (token !== tokenAnterior) {
    setTokenAnterior(token)
    setConsultaRemota(consulta ? { estado: 'carregando' } : { estado: 'ocioso' })
  }

  const [decisao, setDecisao] = useState<'aprovada' | 'rejeitada' | null>(null)

  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState(false)

  useEffect(() => {
    if (!modoSupabase || !validacao.valido) return
    let ativo = true

    buscarSolicitacaoPorToken(token)
      .then((resultado) => {
        if (!ativo) return
        setConsultaRemota(
          resultado.ok && resultado.solicitacao
            ? { estado: 'ok', solicitacao: resultado.solicitacao }
            : { estado: 'erro', erro: resultado.erro ?? 'Link inválido.' },
        )
      })
      .catch(() => {
        if (ativo) {
          setConsultaRemota({
            estado: 'erro',
            erro: 'Não foi possível consultar o link. Tente novamente.',
          })
        }
      })

    return () => {
      ativo = false
    }
  }, [token, validacao.valido])

  const local = modoSupabase
    ? undefined
    : solicitacoesLocais.find((s) => s.aprovacaoToken === token)

  let erroLink: string | null = null
  let carregando = false
  let solicitacao: Solicitacao | null = null

  if (!validacao.valido) {
    erroLink = validacao.motivo ?? 'Token de aprovação inválido.'
  } else if (modoSupabase) {
    carregando = consultaRemota.estado === 'carregando'
    if (consultaRemota.estado === 'erro') erroLink = consultaRemota.erro
    solicitacao = consultaRemota.estado === 'ok' ? consultaRemota.solicitacao : null
  } else if (!local) {
    erroLink = 'Link inválido. Peça uma nova aprovação.'
  } else if (
    !local.tokenExpiraEm ||
    new Date(local.tokenExpiraEm).getTime() < agora
  ) {
    erroLink = 'Link expirado (validade de 7 dias).'
  } else {
    solicitacao = local
  }

  async function decidir(acao: 'aprovar' | 'rejeitar') {
    setProcessando(true)
    const resultado = await decidirPorToken(
      token,
      acao,
      acao === 'rejeitar' ? motivo : undefined,
    )
    setProcessando(false)
    if (!resultado.ok) {
      notificar('erro', resultado.erro ?? 'Não foi possível processar')
      return
    }
    setDecisao(acao === 'aprovar' ? 'aprovada' : 'rejeitada')
  }

  if (carregando) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-2 text-sm text-content-muted">
        <span className="flex items-center gap-2" role="status">
          <Loader2 size={16} className="animate-spin" /> Verificando o link…
        </span>
      </div>
    )
  }

  if (erroLink) {
    return (
      <MensagemCentral
        icone={<ShieldAlert size={28} className="text-danger" />}
        titulo="Link inválido"
        detalhe={erroLink}
      />
    )
  }

  if (!solicitacao) {
    return (
      <MensagemCentral
        icone={<ShieldAlert size={28} className="text-danger" />}
        titulo="Solicitação não encontrada"
        detalhe="O link é válido, mas a solicitação associada não existe mais."
      />
    )
  }

  if (decisao) {
    return (
      <MensagemCentral
        icone={
          decisao === 'aprovada' ? (
            <CheckCircle2 size={28} className="text-success" />
          ) : (
            <XCircle size={28} className="text-danger" />
          )
        }
        titulo={decisao === 'aprovada' ? 'Solicitação aprovada' : 'Solicitação rejeitada'}
        detalhe={`${solicitacao.id} foi ${
          decisao === 'aprovada' ? 'aprovada' : 'rejeitada'
        } com sucesso. O solicitante será notificado.`}
      />
    )
  }

  if (solicitacao.status !== 'Enviada') {
    return (
      <MensagemCentral
        icone={<ShieldAlert size={28} className="text-warning" />}
        titulo="Decisão já registrada"
        detalhe={`Esta solicitação já foi processada com o status "${solicitacao.status}".`}
        badge={<BadgeStatus status={solicitacao.status} />}
      />
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 p-4">
      <div className="w-full max-w-xl rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-xs text-content-muted">
          <CheckCircle2 size={14} className="text-primary" />
          Aprovação por link seguro · válido por 7 dias
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-content">
            {solicitacao.id}
          </span>
          <Badge tom="neutral">{solicitacao.tipo}</Badge>
          <Badge
            tom={
              solicitacao.prioridade === 'Alta'
                ? 'danger'
                : solicitacao.prioridade === 'Baixa'
                  ? 'info'
                  : 'neutral'
            }
          >
            {solicitacao.prioridade}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-content">{solicitacao.descricao}</p>

        <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-content-muted">Solicitante</dt>
            <dd className="text-content">{solicitacao.solicitante}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Aprovador</dt>
            <dd className="text-content">{solicitacao.aprovador}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Data</dt>
            <dd className="text-content">{solicitacao.data}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Status</dt>
            <dd>
              <BadgeStatus status={solicitacao.status} />
            </dd>
          </div>
        </dl>

        {rejeitando ? (
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            <AreaTexto
              label="Motivo da rejeição *"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique o motivo…"
            />
            <div className="flex justify-end gap-2">
              <Botao
                variante="secundario"
                disabled={processando}
                onClick={() => setRejeitando(false)}
              >
                Voltar
              </Botao>
              <Botao
                variante="perigo"
                disabled={motivo.trim().length === 0 || processando}
                onClick={() => void decidir('rejeitar')}
              >
                {processando ? 'Registrando…' : 'Confirmar rejeição'}
              </Botao>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <Botao
              variante="secundario"
              disabled={processando}
              onClick={() => setRejeitando(true)}
            >
              <XCircle size={15} /> Rejeitar
            </Botao>
            <Botao disabled={processando} onClick={() => void decidir('aprovar')}>
              <CheckCircle2 size={15} /> {processando ? 'Registrando…' : 'Aprovar'}
            </Botao>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-content-muted">
          IT Stock &amp; Inventory · A ação fica registrada na auditoria com data e hora.
        </p>
      </div>
    </div>
  )
}

function MensagemCentral({
  icone,
  titulo,
  detalhe,
  badge,
}: {
  icone: React.ReactNode
  titulo: string
  detalhe: string
  badge?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-3">
          {icone}
        </div>
        <h1 className="text-lg font-semibold text-content">{titulo}</h1>
        <p className="mt-2 text-sm text-content-muted">{detalhe}</p>
        {badge && <div className="mt-3 flex justify-center">{badge}</div>}
        <Link
          to="/login"
          className="mt-5 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Ir para o sistema
        </Link>
      </div>
    </div>
  )
}
