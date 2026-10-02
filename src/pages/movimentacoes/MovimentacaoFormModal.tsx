import { useMemo, useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { Entrada, Selecao } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { useAtivosStore } from '../../store/ativos'
import { useMovimentacoesStore } from '../../store/movimentacoes'
import { useSetoresStore } from '../../store/setores'
import { useUiStore } from '../../store/ui'

export function MovimentacaoFormModal({
  aberto,
  aoFechar,
}: {
  aberto: boolean
  aoFechar: () => void
}) {
  const ativos = useAtivosStore((s) => s.ativos)
  const setores = useSetoresStore((s) => s.setores)
  const criar = useMovimentacoesStore((s) => s.criar)
  const notificar = useUiStore((s) => s.notificar)

  const ativosMoviveis = useMemo(
    () => ativos.filter((a) => a.status !== 'Descartado'),
    [ativos],
  )
  const setoresAtivos = useMemo(
    () => setores.filter((s) => s.ativo),
    [setores],
  )

  const [form, setForm] = useState({
    codigoAtivo: '',
    setorDestino: '',
    responsavelDestino: '',
  })
  const [erro, setErro] = useState('')

  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto) {
      setForm({ codigoAtivo: '', setorDestino: '', responsavelDestino: '' })
      setErro('')
    }
  }

  const ativoSelecionado = ativosMoviveis.find((a) => a.codigo === form.codigoAtivo)

  const opcoesSetor = useMemo(
    () =>
      setoresAtivos
        .filter((s) => s.nome !== ativoSelecionado?.setor)
        .map((s) => ({ valor: s.nome, rotulo: s.nome })),
    [setoresAtivos, ativoSelecionado],
  )

  function aoEscolherAtivo(codigo: string) {
    const ativo = ativosMoviveis.find((a) => a.codigo === codigo)
    setForm({
      codigoAtivo: codigo,
      setorDestino: '',
      responsavelDestino: ativo?.responsavel ?? '',
    })
  }

  function salvar() {
    if (!form.codigoAtivo) {
      setErro('Selecione o ativo a ser movimentado.')
      return
    }
    if (!form.setorDestino) {
      setErro('Selecione o setor de destino.')
      return
    }
    const resultado = criar(form)
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível criar a movimentação.')
      return
    }
    notificar(
      'sucesso',
      `${form.codigoAtivo}: movimentação para ${form.setorDestino} criada (pendente de confirmação).`,
    )
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova movimentação de ativo"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>Criar movimentação</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Selecao
          label="Ativo *"
          value={form.codigoAtivo}
          erro={erro && !form.codigoAtivo ? erro : undefined}
          onChange={(e) => aoEscolherAtivo(e.target.value)}
          opcoes={ativosMoviveis.map((a) => ({
            valor: a.codigo,
            rotulo: `${a.codigo} — ${a.descricao} (${a.setor})`,
          }))}
          placeholder="Selecione o ativo…"
        />
        {ativoSelecionado && (
          <p className="text-xs text-content-muted">
            Setor atual: <strong>{ativoSelecionado.setor}</strong> · Responsável:{' '}
            <strong>{ativoSelecionado.responsavel}</strong>
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Selecao
            label="Setor de destino *"
            value={form.setorDestino}
            erro={erro && form.codigoAtivo && !form.setorDestino ? erro : undefined}
            onChange={(e) => setForm({ ...form, setorDestino: e.target.value })}
            opcoes={opcoesSetor}
            placeholder={ativoSelecionado ? 'Selecione…' : 'Escolha o ativo primeiro'}
            disabled={!ativoSelecionado}
          />
          <Entrada
            label="Responsável no destino *"
            value={form.responsavelDestino}
            erro={erro && form.setorDestino ? erro : undefined}
            onChange={(e) => setForm({ ...form, responsavelDestino: e.target.value })}
            placeholder="Quem passa a ser responsável"
          />
        </div>
        <p className="text-xs text-content-muted">
          A movimentação fica <strong>Pendente</strong> até a confirmação; ao confirmar, o setor
          do ativo é atualizado automaticamente.
        </p>
      </div>
    </Modal>
  )
}
