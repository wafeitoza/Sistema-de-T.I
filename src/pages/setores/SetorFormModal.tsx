import { useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { Entrada } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { useSetoresStore } from '../../store/setores'
import { useUiStore } from '../../store/ui'
import type { Setor } from '../../types'

export function SetorFormModal({
  aberto,
  aoFechar,
  setor,
}: {
  aberto: boolean
  aoFechar: () => void
  setor: Setor | null
}) {
  const criar = useSetoresStore((s) => s.criar)
  const editar = useSetoresStore((s) => s.editar)
  const notificar = useUiStore((s) => s.notificar)

  const [form, setForm] = useState({ nome: '', responsavel: '', localizacao: '' })
  const [erro, setErro] = useState('')

  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto) {
      setForm(
        setor
          ? {
              nome: setor.nome,
              responsavel: setor.responsavel,
              localizacao: setor.localizacao,
            }
          : { nome: '', responsavel: '', localizacao: '' },
      )
      setErro('')
    }
  }

  function salvar() {
    if (form.nome.trim().length < 3) {
      setErro('O nome do setor precisa de pelo menos 3 caracteres.')
      return
    }
    const resultado = setor
      ? editar(setor.id, form)
      : criar(form)
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível salvar.')
      return
    }
    notificar('sucesso', setor ? `Setor ${form.nome.trim()} atualizado.` : `Setor ${form.nome.trim()} criado.`)
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={setor ? `Editar ${setor.nome}` : 'Novo setor'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>{setor ? 'Salvar' : 'Criar'}</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Entrada
          label="Nome *"
          value={form.nome}
          erro={erro}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Ex.: TI, Financeiro, Vendas…"
        />
        <Entrada
          label="Responsável"
          value={form.responsavel}
          onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
          placeholder="Nome ou e-mail do responsável pelo setor"
        />
        <Entrada
          label="Localização"
          value={form.localizacao}
          onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
          placeholder="Ex.: 2º andar, sala 204"
        />
      </div>
    </Modal>
  )
}
