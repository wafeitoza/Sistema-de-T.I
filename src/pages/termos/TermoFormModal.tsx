import { useMemo, useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Entrada, Selecao } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { conteudoPadrao } from '../../lib/termos'
import { useAtivosStore } from '../../store/ativos'
import { useTermosStore } from '../../store/termos'
import { useUiStore } from '../../store/ui'

export function TermoFormModal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const ativos = useAtivosStore((s) => s.ativos)
  const criar = useTermosStore((s) => s.criar)
  const notificar = useUiStore((s) => s.notificar)

  const opcoes = useMemo(
    () =>
      ativos
        .filter((a) => a.status !== 'Descartado')
        .map((a) => ({ valor: a.codigo, rotulo: `${a.codigo} — ${a.descricao}` })),
    [ativos],
  )

  const [form, setForm] = useState({ ativo: '', responsavel: '', conteudo: '' })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  const { ativo: ativoCodigo, responsavel, conteudo } = form

  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto) {
      setForm({ ativo: '', responsavel: '', conteudo: '' })
      setErros({})
      setSalvando(false)
    }
  }

  function aoEscolherAtivo(codigo: string) {
    const ativo = ativos.find((a) => a.codigo === codigo)
    if (!ativo) {
      setForm((f) => ({ ...f, ativo: codigo }))
      return
    }
    const resp = responsavel.trim() || ativo.responsavel
    setForm({ ativo: codigo, responsavel: resp, conteudo: conteudoPadrao(ativo, resp) })
  }

  async function salvar() {
    const novosErros: Record<string, string> = {}
    if (!ativos.some((a) => a.codigo === ativoCodigo)) {
      novosErros.ativo = 'Selecione um ativo'
    }
    if (responsavel.trim().length < 3) {
      novosErros.responsavel = 'Informe o responsável pelo ativo'
    }
    if (conteudo.trim().length < 40) {
      novosErros.conteudo = 'O termo precisa de pelo menos 40 caracteres'
    }
    if (Object.keys(novosErros).length) {
      setErros(novosErros)
      return
    }

    setSalvando(true)
    try {
      const termo = await criar({
        ativoCodigo,
        responsavel: responsavel.trim(),
        conteudo: conteudo.trim(),
      })
      notificar('sucesso', `${termo.id} criado com hash SHA-256 registrado.`)
      aoFechar()
    } catch {
      notificar('erro', 'Não foi possível calcular o hash do termo.')
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo termo de responsabilidade"
      largo
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={salvando}>
            {salvando ? 'Calculando hash…' : 'Criar termo'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Selecao
            label="Ativo *"
            value={ativoCodigo}
            erro={erros.ativo}
            onChange={(e) => aoEscolherAtivo(e.target.value)}
            opcoes={opcoes}
            placeholder="Selecione o ativo…"
          />
          <Entrada
            label="Responsável *"
            value={responsavel}
            erro={erros.responsavel}
            onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
            placeholder="nome ou e-mail do responsável"
          />
        </div>
        <AreaTexto
          label="Conteúdo do termo *"
          value={conteudo}
          erro={erros.conteudo}
          onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
          className="[&_textarea]:min-h-52 [&_textarea]:font-mono [&_textarea]:text-xs"
          placeholder="Escolha um ativo para gerar o modelo padrão…"
        />
        <p className="text-xs text-content-muted">
          O hash SHA-256 é calculado sobre o conteúdo, o ativo, o responsável e os metadados de
          criação. Alterações posteriores são detectadas pela revalidação.
        </p>
      </div>
    </Modal>
  )
}
