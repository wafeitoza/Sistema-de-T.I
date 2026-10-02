import { useEffect, useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, CampoMoeda, Entrada, Selecao } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { CATEGORIAS_ESTOQUE, UNIDADES } from '../../lib/codes'
import { formatarNumeroBR, parseMoeda } from '../../lib/format'
import {
  useEstoqueStore,
  type DadosEntrada,
  type DadosSaida,
  type NovoItem,
} from '../../store/estoque'
import { useFornecedoresStore } from '../../store/fornecedores'
import { useUiStore } from '../../store/ui'
import type { ItemEstoque, TipoEntrada, TipoSaida } from '../../types'

function montarOpcoesFornecedor(
  fornecedores: { nome: string; ativo: boolean }[],
  atual: string,
): { valor: string; rotulo: string }[] {
  const opcoes = fornecedores
    .filter((f) => f.ativo)
    .map((f) => ({ valor: f.nome, rotulo: f.nome }))
  if (atual && !opcoes.some((o) => o.valor === atual)) {
    opcoes.unshift({ valor: atual, rotulo: `${atual} (inativo)` })
  }
  return opcoes
}

const TIPOS_ENTRADA: TipoEntrada[] = ['Compra', 'Devolução', 'Ajuste', 'Doação']
const TIPOS_SAIDA: TipoSaida[] = ['Fornecimento', 'Destruição', 'Empréstimo', 'Devolução']

export function ItemEstoqueModal({
  aberto,
  aoFechar,
  item,
}: {
  aberto: boolean
  aoFechar: () => void
  item: ItemEstoque | null
}) {
  const criarItem = useEstoqueStore((s) => s.criarItem)
  const atualizarItem = useEstoqueStore((s) => s.atualizarItem)
  const fornecedoresStore = useFornecedoresStore((s) => s.fornecedores)
  const [form, setForm] = useState({
    descricao: '',
    categoria: '',
    quantidadeMinima: '5',
    unidade: 'Peça',
    fornecedor: '',
    precoUnitario: '',
    notas: '',
  })
  const opcoesFornecedor = montarOpcoesFornecedor(fornecedoresStore, form.fornecedor)
  const [erros, setErros] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!aberto) return
    setErros({})
    setForm(
      item
        ? {
            descricao: item.descricao,
            categoria: item.categoria,
            quantidadeMinima: String(item.quantidadeMinima),
            unidade: item.unidade,
            fornecedor: item.fornecedor ?? '',
            precoUnitario: formatarNumeroBR(item.precoUnitario),
            notas: item.notas ?? '',
          }
        : {
            descricao: '',
            categoria: '',
            quantidadeMinima: '5',
            unidade: 'Peça',
            fornecedor: '',
            precoUnitario: '',
            notas: '',
          },
    )
  }, [aberto, item])

  function salvar() {
    const novosErros: Record<string, string> = {}
    if (!form.descricao.trim()) novosErros.descricao = 'Descrição é obrigatória'
    if (!form.categoria) novosErros.categoria = 'Categoria é obrigatória'
    const minimo = Number(form.quantidadeMinima)
    if (Number.isNaN(minimo) || minimo < 0) {
      novosErros.quantidadeMinima = 'Informe um número válido'
    }
    if (Object.keys(novosErros).length) {
      setErros(novosErros)
      return
    }

    const dados = {
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      quantidadeMinima: minimo,
      unidade: form.unidade,
      fornecedor: form.fornecedor || undefined,
      precoUnitario: parseMoeda(form.precoUnitario),
      notas: form.notas.trim() || undefined,
    }

    if (item) {
      atualizarItem(item.codigo, dados)
    } else {
      criarItem(dados as NovoItem)
    }
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={item ? `Editar ${item.codigo}` : 'Novo item de estoque'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>{item ? 'Salvar' : 'Criar item'}</Botao>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Entrada
          label="Descrição *"
          value={form.descricao}
          erro={erros.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder="Cabo de rede CAT6 3m"
          className="sm:col-span-2"
        />
        <Selecao
          label="Categoria *"
          value={form.categoria}
          erro={erros.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          opcoes={CATEGORIAS_ESTOQUE.map((c) => ({ valor: c, rotulo: c }))}
          placeholder="Selecione…"
        />
        <Selecao
          label="Unidade"
          value={form.unidade}
          onChange={(e) => setForm({ ...form, unidade: e.target.value })}
          opcoes={UNIDADES.map((u) => ({ valor: u, rotulo: u }))}
        />
        <Entrada
          label="Quantidade mínima *"
          value={form.quantidadeMinima}
          erro={erros.quantidadeMinima}
          onChange={(e) => setForm({ ...form, quantidadeMinima: e.target.value })}
          type="number"
          min="0"
        />
        <CampoMoeda
          label="Preço unitário"
          valor={form.precoUnitario}
          aoMudar={(texto) => setForm({ ...form, precoUnitario: texto })}
          placeholder="0,00"
        />
        <Selecao
          label="Fornecedor"
          value={form.fornecedor}
          onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
          opcoes={opcoesFornecedor}
          placeholder="Selecione…"
          className="sm:col-span-2"
        />
        <AreaTexto
          label="Notas"
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}

export function MovimentoModal({
  aberto,
  aoFechar,
  tipo,
  codigoInicial,
}: {
  aberto: boolean
  aoFechar: () => void
  tipo: 'entrada' | 'saida'
  codigoInicial?: string
}) {
  const itens = useEstoqueStore((s) => s.itens)
  const registrarEntrada = useEstoqueStore((s) => s.registrarEntrada)
  const registrarSaida = useEstoqueStore((s) => s.registrarSaida)
  const fornecedoresStore = useFornecedoresStore((s) => s.fornecedores)
  const notificar = useUiStore((s) => s.notificar)
  const [form, setForm] = useState({
    codigoItem: '',
    quantidade: '1',
    tipoMovimento: tipo === 'entrada' ? 'Compra' : 'Fornecimento',
    fornecedor: '',
    nf: '',
    responsavel: '',
    motivo: '',
    notas: '',
  })
  const opcoesFornecedor = montarOpcoesFornecedor(fornecedoresStore, form.fornecedor)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    setErro('')
    setForm({
      codigoItem: codigoInicial ?? '',
      quantidade: '1',
      tipoMovimento: tipo === 'entrada' ? 'Compra' : 'Fornecimento',
      fornecedor: '',
      nf: '',
      responsavel: '',
      motivo: '',
      notas: '',
    })
  }, [aberto, tipo, codigoInicial])

  function salvar() {
    const quantidade = Number(form.quantidade)
    if (!form.codigoItem) return setErro('Selecione um item')
    if (Number.isNaN(quantidade) || quantidade <= 0) {
      return setErro('Quantidade deve ser maior que zero')
    }

    const resultado =
      tipo === 'entrada'
        ? registrarEntrada({
            codigoItem: form.codigoItem,
            quantidade,
            tipo: form.tipoMovimento as TipoEntrada,
            fornecedor: form.fornecedor || undefined,
            nf: form.nf || undefined,
            notas: form.notas || undefined,
          } as DadosEntrada)
        : registrarSaida({
            codigoItem: form.codigoItem,
            quantidade,
            tipo: form.tipoMovimento as TipoSaida,
            responsavel: form.responsavel,
            motivo: form.motivo || undefined,
          } as DadosSaida)

    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Falha ao registrar movimento')
      return
    }
    notificar('sucesso', 'Movimentação registrada com sucesso.')
    aoFechar()
  }

  const opcoesItens = itens.map((i) => ({
    valor: i.codigo,
    rotulo: `${i.codigo} — ${i.descricao} (${i.quantidade} ${i.unidade})`,
  }))

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={tipo === 'entrada' ? 'Registrar entrada' : 'Registrar saída'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>Registrar</Botao>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Selecao
          label="Item *"
          value={form.codigoItem}
          onChange={(e) => setForm({ ...form, codigoItem: e.target.value })}
          opcoes={opcoesItens}
          placeholder="Selecione…"
          className="sm:col-span-2"
        />
        <Entrada
          label="Quantidade *"
          value={form.quantidade}
          onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
          type="number"
          min="1"
        />
        <Selecao
          label={tipo === 'entrada' ? 'Tipo de entrada' : 'Tipo de saída'}
          value={form.tipoMovimento}
          onChange={(e) => setForm({ ...form, tipoMovimento: e.target.value })}
          opcoes={(tipo === 'entrada' ? TIPOS_ENTRADA : TIPOS_SAIDA).map((t) => ({
            valor: t,
            rotulo: t,
          }))}
        />

        {tipo === 'entrada' ? (
          <>
            <Selecao
              label="Fornecedor"
              value={form.fornecedor}
              onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
              opcoes={opcoesFornecedor}
              placeholder="Selecione…"
            />
            <Entrada
              label="Nota fiscal"
              value={form.nf}
              onChange={(e) => setForm({ ...form, nf: e.target.value })}
              placeholder="NF-88213"
            />
            <AreaTexto
              label="Notas"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="sm:col-span-2"
            />
          </>
        ) : (
          <>
            <Entrada
              label="Responsável (e-mail) *"
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              placeholder="tecnico@empresa.com"
              type="email"
            />
            <Entrada
              label="Motivo"
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              placeholder="Setup de estação"
            />
          </>
        )}

        {erro && (
          <p className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
