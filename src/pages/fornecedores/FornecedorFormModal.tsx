import { useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { Entrada } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { useFornecedoresStore, type DadosFornecedor } from '../../store/fornecedores'
import { useUiStore } from '../../store/ui'
import type { Fornecedor } from '../../types'

export function FornecedorFormModal({
  aberto,
  aoFechar,
  fornecedor,
}: {
  aberto: boolean
  aoFechar: () => void
  fornecedor: Fornecedor | null
}) {
  const criar = useFornecedoresStore((s) => s.criar)
  const editar = useFornecedoresStore((s) => s.editar)
  const notificar = useUiStore((s) => s.notificar)

  const [form, setForm] = useState<DadosFornecedor>({
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
  })
  const [erro, setErro] = useState('')

  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto) {
      setForm(
        fornecedor
          ? {
              nome: fornecedor.nome,
              cnpj: fornecedor.cnpj,
              email: fornecedor.email ?? '',
              telefone: fornecedor.telefone ?? '',
            }
          : { nome: '', cnpj: '', email: '', telefone: '' },
      )
      setErro('')
    }
  }

  function salvar() {
    if (form.nome.trim().length < 3) {
      setErro('Informe a razão social com pelo menos 3 caracteres.')
      return
    }
    const resultado = fornecedor ? editar(fornecedor.id, form) : criar(form)
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível salvar.')
      return
    }
    notificar(
      'sucesso',
      fornecedor
        ? `Fornecedor ${form.nome.trim()} atualizado.`
        : `Fornecedor ${form.nome.trim()} criado.`,
    )
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={fornecedor ? `Editar ${fornecedor.nome}` : 'Novo fornecedor'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>{fornecedor ? 'Salvar' : 'Criar'}</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Entrada
          label="Razão social *"
          value={form.nome}
          erro={erro}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Nome do fornecedor"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Entrada
            label="CNPJ"
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            placeholder="00.000.000/0001-00"
          />
          <Entrada
            label="Telefone"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            placeholder="(71) 99999-0000"
          />
        </div>
        <Entrada
          label="E-mail"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="contato@fornecedor.com"
        />
      </div>
    </Modal>
  )
}
