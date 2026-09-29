import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto } from '../../components/ui/Campos'
import { validarTokenAprovacao } from '../../lib/token'
import { useSolicitacoesStore } from '../../store/solicitacoes'
import { useUiStore } from '../../store/ui'

export function AprovacaoPage() {
  const { token = '' } = useParams()
  const validacao = validarTokenAprovacao(token)
  const { solicitacoes, decidirPorToken } = useSolicitacoesStore()
  const notificar = useUiStore((s) => s.notificar)

  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [decisao, setDecisao] = useState<'aprovada' | 'rejeitada' | null>(null)

  const solicitacao = validacao.valido
    ? solicitacoes.find((s) => s.id === validacao.idSolicitacao)
    : undefined

  function decidir(acao: 'aprovar' | 'rejeitar') {
    const resultado = decidirPorToken(token, acao, motivo)
    if (!resultado.ok) {
      notificar('erro', resultado.erro ?? 'Não foi possível processar')
      return
    }
    setDecisao(acao === 'aprovar' ? 'aprovada' : 'rejeitada')
  }

  if (!validacao.valido) {
    return (
      <MensagemCentral
        icone={<ShieldAlert size={28} className="text-danger" />}
        titulo="Link inválido"
        detalhe={validacao.motivo ?? 'Token de aprovação inválido.'}
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
          Aprovação via link assinado · válido por 7 dias
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
              <Botao variante="secundario" onClick={() => setRejeitando(false)}>
                Voltar
              </Botao>
              <Botao
                variante="perigo"
                disabled={motivo.trim().length === 0}
                onClick={() => decidir('rejeitar')}
              >
                Confirmar rejeição
              </Botao>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <Botao variante="secundario" onClick={() => setRejeitando(true)}>
              <XCircle size={15} /> Rejeitar
            </Botao>
            <Botao onClick={() => decidir('aprovar')}>
              <CheckCircle2 size={15} /> Aprovar
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
