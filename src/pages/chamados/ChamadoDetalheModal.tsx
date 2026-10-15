import { useMemo, useState } from 'react'
import { ExternalLink, Mail, MailOpen, Send } from 'lucide-react'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Selecao } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { lerColecao } from '../../data/repository'
import { responderPorGmail } from '../../lib/gmail'
import { formatarData } from '../../lib/format'
import {
  PRIORIDADES_CHAMADO,
  mensagensDo,
  transicaoPermitida,
  useChamadosStore,
} from '../../store/chamados'
import { useUiStore } from '../../store/ui'
import type { Chamado, Perfil, StatusChamado, Usuario } from '../../types'

const ROTULO_STATUS: Record<StatusChamado, string> = {
  Aberto: 'Assumir',
  'Em atendimento': 'Concluir',
  'Aguardando usuário': 'Aguardando solicitante',
  Resolvido: 'Resolver',
  Cancelado: 'Cancelar',
}

/** O que vira botão dado o estado atual — `transicaoPermitida` decide. */
const DESTINOS: StatusChamado[] = [
  'Em atendimento',
  'Aguardando usuário',
  'Resolvido',
  'Cancelado',
  'Aberto',
]

export function ChamadoDetalheModal({
  chamado,
  perfil,
  aoFechar,
}: {
  chamado: Chamado | null
  perfil?: Perfil
  aoFechar: () => void
}) {
  const { mensagens, mudarStatus, atribuir, mudarPrioridade } = useChamadosStore()
  const notificar = useUiStore((s) => s.notificar)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)

  const fio = useMemo(
    () => (chamado ? mensagensDo(mensagens, chamado.id) : []),
    [mensagens, chamado],
  )

  const atendentes = useMemo(
    () =>
      lerColecao<Usuario>('USUARIOS')
        .filter((u) => u.status === 'Ativo' && u.perfil !== 'Visualizador')
        .map((u) => ({ valor: u.email, rotulo: `${u.nome} (${u.perfil})` })),
    [],
  )

  if (!chamado) return null
  const operar = perfil !== 'Visualizador'
  const fechado = chamado.status === 'Resolvido' || chamado.status === 'Cancelado'

  async function enviarResposta() {
    if (!chamado) return
    const texto = resposta.trim()
    if (texto.length < 2) {
      notificar('erro', 'Escreva a resposta antes de enviar.')
      return
    }
    setEnviando(true)
    const r = await responderPorGmail(chamado.id, texto)
    setEnviando(false)

    if (!r.ok) {
      notificar('erro', r.erro ?? 'Não foi possível enviar a resposta.')
      return
    }
    // a mensagem escrita no fio entra pela próxima sincronização — aqui já
    // registramos a saída para o histórico não parecer incompleto
    useChamadosStore.getState().anexarMensagem({
      id: `${chamado.id}-local-${Date.now()}`,
      chamadoId: chamado.id,
      direcao: 'enviada',
      remetente: String(r.dados?.para ?? chamado.solicitante),
      destinatarios: chamado.solicitante,
      assunto: `Re: ${chamado.assunto}`,
      corpo: texto,
      recebidoEm: new Date().toISOString(),
      criadoEm: new Date().toISOString(),
    })
    notificar('sucesso', `Resposta enviada para ${chamado.solicitante}.`)
    setResposta('')
  }

  return (
    <Modal aberto={!!chamado} aoFechar={aoFechar} titulo={chamado.id} largo>
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatus status={chamado.status} />
            <Badge tom="neutral">{chamado.prioridade}</Badge>
            <Badge tom={chamado.origem === 'E-mail' ? 'info' : 'neutral'}>
              {chamado.origem === 'E-mail' ? 'Veio do e-mail' : 'Aberto na tela'}
            </Badge>
          </div>
          <h3 className="mt-2 text-base font-semibold">{chamado.assunto}</h3>
          {chamado.descricao && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-content-muted">{chamado.descricao}</p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-content-muted">Solicitante</dt>
            <dd className="break-all">{chamado.solicitante}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Responsável</dt>
            <dd className="break-all">{chamado.atribuidoA ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Aberto em</dt>
            <dd>{formatarData(chamado.criadoEm)}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Última alteração</dt>
            <dd>{formatarData(chamado.atualizadoEm)}</dd>
          </div>
        </dl>

        {chamado.emailUrl && (
          <a
            href={chamado.emailUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink size={13} /> Abrir a conversa no Gmail
          </a>
        )}

        {operar && !fechado && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Selecao
              label="Responsável"
              value={chamado.atribuidoA ?? ''}
              onChange={(e) => {
                const r = atribuir(chamado.id, e.target.value)
                if (!r.ok) notificar('erro', r.erro ?? 'Não foi possível atribuir.')
              }}
              placeholder="Sem responsável"
              opcoes={atendentes}
            />
            <Selecao
              label="Prioridade"
              value={chamado.prioridade}
              onChange={(e) => {
                const r = mudarPrioridade(chamado.id, e.target.value as never)
                if (!r.ok) notificar('erro', r.erro ?? 'Não foi possível alterar a prioridade.')
              }}
              opcoes={PRIORIDADES_CHAMADO.map((p) => ({ valor: p, rotulo: p }))}
            />
          </div>
        )}

        {operar && (
          <div className="flex flex-wrap gap-2">
            {DESTINOS.filter((d) => transicaoPermitida(chamado.status, d)).map((d) => (
              <Botao
                key={d}
                tamanho="sm"
                variante={d === 'Resolvido' ? 'primario' : d === 'Cancelado' ? 'perigo' : 'secundario'}
                onClick={() => {
                  const r = mudarStatus(chamado.id, d)
                  if (!r.ok) notificar('erro', r.erro ?? 'Não foi possível mudar o status.')
                  else notificar('info', `${chamado.id} → ${d}.`)
                }}
              >
                {ROTULO_STATUS[d]}
              </Botao>
            ))}
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-semibold">Conversa</h4>
          {fio.length === 0 ? (
            <p className="text-sm text-content-muted">
              Nenhuma mensagem registrada. Chamados vindos do e-mail trazem o fio aqui depois da
              sincronização.
            </p>
          ) : (
            <ul className="space-y-3">
              {fio.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-lg border p-3 ${
                    m.direcao === 'enviada'
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-line bg-surface-2'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs text-content-muted">
                    {m.direcao === 'enviada' ? <MailOpen size={13} /> : <Mail size={13} />}
                    <span className="font-medium text-content">
                      {m.direcao === 'enviada' ? 'Nós' : m.remetente}
                    </span>
                    <span>· {formatarData(m.recebidoEm)}</span>
                  </div>
                  {m.corpo && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">{m.corpo}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {operar && (
          <div className="space-y-2 border-t border-line pt-4">
            <AreaTexto
              label="Responder ao solicitante"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={3}
              placeholder={`A resposta sai pelo e-mail conectado para ${chamado.solicitante}.`}
            />
            <Botao tamanho="sm" disabled={enviando} onClick={enviarResposta}>
              <Send size={14} /> {enviando ? 'Enviando…' : 'Enviar resposta'}
            </Botao>
          </div>
        )}
      </div>
    </Modal>
  )
}
