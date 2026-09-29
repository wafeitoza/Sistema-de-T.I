import { useEffect, useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Entrada, Selecao } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { SETORES, TIPOS_ATIVO } from '../../lib/codes'
import { errosAtivo } from '../../lib/validation'
import { useAtivosStore } from '../../store/ativos'
import type { Ativo } from '../../types'

interface Props {
  aberto: boolean
  aoFechar: () => void
  ativo?: Ativo | null
}

interface Formulario {
  descricao: string
  tipo: string
  marca: string
  modelo: string
  serial: string
  setor: string
  responsavel: string
  dataAquisicao: string
  valorAquisicao: string
  localizacao: string
  notas: string
}

const VAZIO: Formulario = {
  descricao: '',
  tipo: '',
  marca: '',
  modelo: '',
  serial: '',
  setor: '',
  responsavel: '',
  dataAquisicao: '',
  valorAquisicao: '',
  localizacao: '',
  notas: '',
}

export function AtivoFormModal({ aberto, aoFechar, ativo }: Props) {
  const criar = useAtivosStore((s) => s.criar)
  const atualizar = useAtivosStore((s) => s.atualizar)
  const [form, setForm] = useState<Formulario>(VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!aberto) return
    setErros({})
    setForm(
      ativo
        ? {
            descricao: ativo.descricao,
            tipo: ativo.tipo,
            marca: ativo.marca ?? '',
            modelo: ativo.modelo ?? '',
            serial: ativo.serial ?? '',
            setor: ativo.setor,
            responsavel: ativo.responsavel,
            dataAquisicao: ativo.dataAquisicao,
            valorAquisicao: ativo.valorAquisicao?.toString() ?? '',
            localizacao: ativo.localizacao ?? '',
            notas: ativo.notas ?? '',
          }
        : VAZIO,
    )
  }, [aberto, ativo])

  function campo<K extends keyof Formulario>(nome: K, valor: Formulario[K]) {
    setForm((f) => ({ ...f, [nome]: valor }))
  }

  function salvar() {
    const validacao = errosAtivo(form)
    if (Object.keys(validacao).length > 0) {
      setErros(validacao)
      return
    }

    const dados = {
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      marca: form.marca.trim() || undefined,
      modelo: form.modelo.trim() || undefined,
      serial: form.serial.trim() || undefined,
      setor: form.setor,
      responsavel: form.responsavel.trim(),
      dataAquisicao: form.dataAquisicao,
      valorAquisicao: form.valorAquisicao ? Number(form.valorAquisicao) : undefined,
      localizacao: form.localizacao.trim() || undefined,
      notas: form.notas.trim() || undefined,
    }

    if (ativo) {
      atualizar(ativo.codigo, dados)
    } else {
      criar(dados)
    }
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={ativo ? `Editar ${ativo.codigo}` : 'Novo ativo'}
      largo
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>{ativo ? 'Salvar alterações' : 'Criar ativo'}</Botao>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Entrada
          label="Descrição *"
          value={form.descricao}
          erro={erros.descricao}
          onChange={(e) => campo('descricao', e.target.value)}
          placeholder="Notebook Dell Latitude 5540"
          className="sm:col-span-2"
        />
        <Selecao
          label="Tipo *"
          value={form.tipo}
          erro={erros.tipo}
          onChange={(e) => campo('tipo', e.target.value)}
          opcoes={TIPOS_ATIVO.map((t) => ({ valor: t, rotulo: t }))}
          placeholder="Selecione…"
        />
        <Selecao
          label="Setor *"
          value={form.setor}
          erro={erros.setor}
          onChange={(e) => campo('setor', e.target.value)}
          opcoes={SETORES.map((s) => ({ valor: s, rotulo: s }))}
          placeholder="Selecione…"
        />
        <Entrada
          label="Marca"
          value={form.marca}
          onChange={(e) => campo('marca', e.target.value)}
          placeholder="Dell"
        />
        <Entrada
          label="Modelo"
          value={form.modelo}
          onChange={(e) => campo('modelo', e.target.value)}
          placeholder="Latitude 5540"
        />
        <Entrada
          label="Serial"
          value={form.serial}
          onChange={(e) => campo('serial', e.target.value)}
          placeholder="DL5540-9921"
        />
        <Entrada
          label="Responsável (e-mail) *"
          value={form.responsavel}
          erro={erros.responsavel}
          onChange={(e) => campo('responsavel', e.target.value)}
          placeholder="tecnico@empresa.com"
          type="email"
        />
        <Entrada
          label="Data de aquisição *"
          value={form.dataAquisicao}
          erro={erros.dataAquisicao}
          onChange={(e) => campo('dataAquisicao', e.target.value)}
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
        />
        <Entrada
          label="Valor de aquisição (R$)"
          value={form.valorAquisicao}
          onChange={(e) => campo('valorAquisicao', e.target.value)}
          placeholder="5490"
          type="number"
          min="0"
          step="0.01"
        />
        <Entrada
          label="Localização física"
          value={form.localizacao}
          onChange={(e) => campo('localizacao', e.target.value)}
          placeholder="Sala TI - Armário 1"
          className="sm:col-span-2"
        />
        <AreaTexto
          label="Notas"
          value={form.notas}
          onChange={(e) => campo('notas', e.target.value)}
          placeholder="Observações opcionais…"
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}
