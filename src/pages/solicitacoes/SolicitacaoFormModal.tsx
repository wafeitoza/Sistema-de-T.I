import { useEffect, useMemo, useState } from 'react'
import { lerColecao } from '../../data/repository'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Selecao } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { useAuthStore } from '../../store/auth'
import { useSolicitacoesStore } from '../../store/solicitacoes'
import type { Prioridade, Solicitacao, TipoSolicitacao, Usuario } from '../../types'

const TIPOS: TipoSolicitacao[] = [
  'Novo Ativo',
  'Substituição',
  'Reparo',
  'Consumível',
  'Manutenção',
  'Outro',
]

const PRIORIDADES: Prioridade[] = ['Alta', 'Normal', 'Baixa']

export function SolicitacaoFormModal({
  aberto,
  aoFechar,
  solicitacao,
}: {
  aberto: boolean
  aoFechar: () => void
  solicitacao: Solicitacao | null
}) {
  const usuario = useAuthStore((s) => s.usuario)
  const criar = useSolicitacoesStore((s) => s.criar)
  const editar = useSolicitacoesStore((s) => s.editar)

  const opcoesAprovador = useMemo(() => {
    const usuarios = lerColecao<Usuario>('USUARIOS')
    return usuarios
      .filter((u) => u.perfil === 'Admin' || u.perfil === 'Gerente')
      .map((u) => ({ valor: u.email, rotulo: `${u.nome} (${u.perfil})` }))
  }, [])

  const [form, setForm] = useState({
    tipo: 'Novo Ativo' as TipoSolicitacao,
    descricao: '',
    prioridade: 'Normal' as Prioridade,
    aprovador: '',
    notasInternas: '',
  })
  const [erros, setErros] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!aberto) return
    setErros({})
    setForm(
      solicitacao
        ? {
            tipo: solicitacao.tipo,
            descricao: solicitacao.descricao,
            prioridade: solicitacao.prioridade,
            aprovador: solicitacao.aprovador,
            notasInternas: solicitacao.notasInternas ?? '',
          }
        : {
            tipo: 'Novo Ativo',
            descricao: '',
            prioridade: 'Normal',
            aprovador: opcoesAprovador[0]?.valor ?? '',
            notasInternas: '',
          },
    )
  }, [aberto, solicitacao])

  function salvar() {
    const novosErros: Record<string, string> = {}
    if (form.descricao.trim().length < 10) {
      novosErros.descricao = 'Descreva a solicitação com pelo menos 10 caracteres'
    }
    if (!form.aprovador) novosErros.aprovador = 'Selecione um aprovador'
    if (Object.keys(novosErros).length) {
      setErros(novosErros)
      return
    }

    const dados = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      prioridade: form.prioridade,
      aprovador: form.aprovador,
      notasInternas: form.notasInternas.trim() || undefined,
    }

    if (solicitacao) {
      editar(solicitacao.id, dados)
    } else {
      criar({ ...dados, solicitante: usuario?.email ?? '' })
    }
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={solicitacao ? `Editar ${solicitacao.id}` : 'Nova solicitação'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>{solicitacao ? 'Salvar' : 'Criar rascunho'}</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Selecao
            label="Tipo"
            value={form.tipo}
            onChange={(e) =>
              setForm({ ...form, tipo: e.target.value as TipoSolicitacao })
            }
            opcoes={TIPOS.map((t) => ({ valor: t, rotulo: t }))}
          />
          <Selecao
            label="Prioridade"
            value={form.prioridade}
            onChange={(e) =>
              setForm({ ...form, prioridade: e.target.value as Prioridade })
            }
            opcoes={PRIORIDADES.map((p) => ({ valor: p, rotulo: p }))}
          />
        </div>
        <Selecao
          label="Aprovador *"
          value={form.aprovador}
          erro={erros.aprovador}
          onChange={(e) => setForm({ ...form, aprovador: e.target.value })}
          opcoes={opcoesAprovador}
          placeholder="Selecione…"
        />
        <AreaTexto
          label="Descrição *"
          value={form.descricao}
          erro={erros.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder="Detalhe o que é necessário, justificativa, quantidades…"
        />
        <AreaTexto
          label="Notas internas (equipe de T.I.)"
          value={form.notasInternas}
          onChange={(e) => setForm({ ...form, notasInternas: e.target.value })}
        />
      </div>
    </Modal>
  )
}
