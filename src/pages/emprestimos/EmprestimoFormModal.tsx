import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Entrada, Selecao } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { hojeBR, somarDiasBR } from '../../lib/format'
import { useAtivosStore } from '../../store/ativos'
import { useEmprestimosStore, type DadosEmprestimo } from '../../store/emprestimos'
import { useUiStore } from '../../store/ui'
import type { Ativo, Emprestimo } from '../../types'

interface Formulario {
  codigoAtivo: string
  funcionario: string
  matricula: string
  setor: string
  dataEmprestimo: string
  previsaoDevolucao: string
  observacao: string
}

function formularioVazio(codigoAtivo = ''): Formulario {
  return {
    codigoAtivo,
    funcionario: '',
    matricula: '',
    setor: '',
    dataEmprestimo: hojeBR(),
    previsaoDevolucao: somarDiasBR(hojeBR(), 7),
    observacao: '',
  }
}

export function EmprestimoFormModal({
  aberto,
  aoFechar,
}: {
  aberto: boolean
  aoFechar: () => void
}) {
  const emprestar = useEmprestimosStore((s) => s.emprestar)
  const emprestimos = useEmprestimosStore((s) => s.emprestimos)
  const { ativos } = useAtivosStore()
  const notificar = useUiStore((s) => s.notificar)

  const [form, setForm] = useState<Formulario>(formularioVazio())
  const [erros, setErros] = useState<Record<string, string>>({})

  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto) {
      setForm(formularioVazio())
      setErros({})
    }
  }

  const emprestados = new Set(
    emprestimos.filter((e: Emprestimo) => e.status === 'Em aberto').map((e) => e.codigoAtivo),
  )
  const disponiveis = ativos.filter(
    (a) => a.status !== 'Descartado' && !emprestados.has(a.codigo),
  )

  function salvar() {
    const dados: DadosEmprestimo = form
    const resultado = emprestar(dados)
    if (!resultado.ok) {
      setErros({ geral: resultado.erro ?? 'Não foi possível registrar o empréstimo.' })
      return
    }
    notificar(
      'sucesso',
      `Empréstimo de ${form.codigoAtivo} registrado para ${form.funcionario.trim()}.`,
    )
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo empréstimo"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>Registrar empréstimo</Botao>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Selecao
          label="Equipamento *"
          value={form.codigoAtivo}
          erro={erros.codigoAtivo}
          onChange={(e) => setForm({ ...form, codigoAtivo: e.target.value })}
          opcoes={disponiveis.map((a: Ativo) => ({
            valor: a.codigo,
            rotulo: `${a.codigo} — ${a.descricao}`,
          }))}
          placeholder={disponiveis.length ? 'Selecione…' : 'Nenhum equipamento disponível'}
          className="sm:col-span-2"
          disabled={!disponiveis.length}
        />
        <Entrada
          label="Nome do funcionário *"
          value={form.funcionario}
          erro={erros.funcionario}
          onChange={(e) => setForm({ ...form, funcionario: e.target.value })}
          placeholder="Nome completo"
        />
        <Entrada
          label="Matrícula"
          value={form.matricula}
          onChange={(e) => setForm({ ...form, matricula: e.target.value })}
          placeholder="000000"
        />
        <Entrada
          label="Setor *"
          value={form.setor}
          erro={erros.setor}
          onChange={(e) => setForm({ ...form, setor: e.target.value })}
          placeholder="Financeiro, Vendas…"
        />
        <Entrada
          label="Data do empréstimo *"
          value={form.dataEmprestimo}
          erro={erros.dataEmprestimo}
          onChange={(e) => setForm({ ...form, dataEmprestimo: e.target.value })}
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
        />
        <Entrada
          label="Previsão de devolução *"
          value={form.previsaoDevolucao}
          erro={erros.previsaoDevolucao}
          onChange={(e) => setForm({ ...form, previsaoDevolucao: e.target.value })}
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
        />
        <AreaTexto
          label="Observação do empréstimo"
          value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
          placeholder="Motivo do uso pessoal, acessórios entregues…"
          className="sm:col-span-2"
        />
      </div>

      {erros.geral && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{erros.geral}</p>
      )}

      <p className="mt-3 flex items-start gap-2 rounded-lg bg-primary-light px-3 py-2 text-xs text-primary dark:bg-primary/10">
        <CalendarClock size={14} className="mt-0.5 shrink-0" />
        O equipamento continua com status <strong>Ativo</strong> no cadastro. Prazo padrão de
        devolução: 7 dias.
      </p>
    </Modal>
  )
}
