import { useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Entrada, Selecao } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { lerColecao } from '../../data/repository'
import { useAuthStore } from '../../store/auth'
import { PRIORIDADES_CHAMADO, useChamadosStore } from '../../store/chamados'
import { useUiStore } from '../../store/ui'
import type { PrioridadeChamado, Usuario } from '../../types'

const TOM_PRIORIDADE: Record<string, string> = {
  Crítica: ' · crítica',
  Alta: ' · alta',
  Média: '',
  Baixa: ' · baixa',
}

export function ChamadoFormModal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { abrir } = useChamadosStore()
  const notificar = useUiStore((s) => s.notificar)
  const usuario = useAuthStore((s) => s.usuario)

  const [assunto, setAssunto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [solicitante, setSolicitante] = useState(usuario?.email ?? '')
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>('Média')
  const [erro, setErro] = useState('')

  // Quem atende é quem está logado: abrir chamado para si mesmo é o caso
  // comum (a TI registra o pedido que recebeu por telefone ou na porta).
  const atendentes = lerColecao<Usuario>('USUARIOS')
    .filter((u) => u.status === 'Ativo' && u.perfil !== 'Visualizador')
    .map((u) => ({ valor: u.email, rotulo: `${u.nome} (${u.perfil})` }))

  function enviar() {
    const r = abrir({ assunto, descricao, solicitante, prioridade })
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível abrir o chamado.')
      return
    }
    notificar('sucesso', 'Chamado aberto.')
    setAssunto('')
    setDescricao('')
    setErro('')
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo chamado"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={enviar}>Abrir chamado</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Entrada
          label="Assunto"
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          placeholder="Ex.: notebook não liga"
          erro={erro && assunto.trim().length < 3 ? erro : undefined}
        />
        <AreaTexto
          label="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={4}
          placeholder="O que aconteceu, quando começou, o que já foi tentado…"
        />
        <Entrada
          label="E-mail de quem solicita"
          type="email"
          value={solicitante}
          onChange={(e) => setSolicitante(e.target.value)}
          placeholder="fulano@empresa.com"
        />
        <Selecao
          label="Prioridade"
          value={prioridade}
          onChange={(e) => setPrioridade(e.target.value as PrioridadeChamado)}
          opcoes={PRIORIDADES_CHAMADO.map((p) => ({ valor: p, rotulo: `${p}${TOM_PRIORIDADE[p]}` }))}
        />
        {atendentes.length > 0 && (
          <p className="text-xs text-content-muted">
            Chamado manual: a resposta por e-mail só sai depois que a caixa for conectada na aba de
            integração.
          </p>
        )}
      </div>
    </Modal>
  )
}
