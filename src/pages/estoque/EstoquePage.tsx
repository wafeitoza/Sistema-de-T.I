import { useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'
import { BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Selecao } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Paginacao } from '../../components/ui/Paginacao'
import { Resumo } from '../../components/ui/Resumo'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { CATEGORIAS_ESTOQUE } from '../../lib/codes'
import { formatarMoeda } from '../../lib/format'
import { podeEditar } from '../../lib/permissions'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { statusEstoque, useEstoqueStore } from '../../store/estoque'
import { useAuthStore } from '../../store/auth'
import type { ItemEstoque } from '../../types'
import { ItemEstoqueModal, MovimentoModal } from './EstoqueModals'

export function EstoquePage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { itens, entradas, saidas } = useEstoqueStore()
  const editar = podeEditar(usuario?.perfil ?? 'Visualizador')

  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [modalItem, setModalItem] = useState(false)
  const [itemEdicao, setItemEdicao] = useState<ItemEstoque | null>(null)
  const [movimento, setMovimento] = useState<{
    tipo: 'entrada' | 'saida'
    codigo?: string
  } | null>(null)
  const [historico, setHistorico] = useState<ItemEstoque | null>(null)
  const { ord, ordenar } = useOrdenacao('codigo')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter((i) => {
      if (categoria && i.categoria !== categoria) return false
      if (!termo) return true
      return (
        i.codigo.toLowerCase().includes(termo) ||
        i.descricao.toLowerCase().includes(termo)
      )
    })
  }, [itens, busca, categoria])

  const pag = usePaginacao(filtrados.length)
  const visiveis = useMemo(
    () =>
      ordenarPor(
        filtrados,
        ord,
        (i, chave) => (chave === 'status' ? statusEstoque(i) : undefined),
      ).slice(pag.inicio, pag.fim),
    [filtrados, ord, pag.inicio, pag.fim],
  )

  const valorTotal = itens.reduce(
    (soma, i) => soma + i.quantidade * (i.precoUnitario ?? 0),
    0,
  )
  const emRisco = itens.filter((i) => statusEstoque(i) !== 'Normal').length

  const movimentosHistorico = historico
    ? [
        ...entradas
          .filter((e) => e.codigoItem === historico.codigo)
          .map((e) => ({
            id: e.id,
            data: e.data,
            rotulo: `Entrada · ${e.tipo}`,
            quantidade: `+${e.quantidade}`,
            usuario: e.usuario,
            tom: 'text-success' as const,
          })),
        ...saidas
          .filter((s) => s.codigoItem === historico.codigo)
          .map((s) => ({
            id: s.id,
            data: s.data,
            rotulo: `Saída · ${s.tipo}`,
            quantidade: `-${s.quantidade}`,
            usuario: s.usuario,
            tom: 'text-danger' as const,
          })),
      ].sort((a, b) => b.data.localeCompare(a.data))
    : []

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          editar ? (
            <div className="flex flex-wrap gap-2">
              <Botao
                variante="secundario"
                onClick={() => setMovimento({ tipo: 'entrada' })}
              >
                <ArrowDownToLine size={16} /> Entrada
              </Botao>
              <Botao
                variante="secundario"
                onClick={() => setMovimento({ tipo: 'saida' })}
              >
                <ArrowUpFromLine size={16} /> Saída
              </Botao>
              <Botao
                onClick={() => {
                  setItemEdicao(null)
                  setModalItem(true)
                }}
              >
                <Plus size={16} /> Novo item
              </Botao>
            </div>
          ) : null
        }
      >
        Estoque
      </TituloSecao>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Itens cadastrados" valor={String(itens.length)} />
        <Resumo titulo="Itens em risco" valor={String(emRisco)} destaque={emRisco > 0} />
        <Resumo titulo="Valor em estoque" valor={formatarMoeda(valorTotal)} />
        <Resumo
          titulo="Movimentações"
          valor={String(entradas.length + saidas.length)}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item…"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Selecao
          label=""
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          opcoes={CATEGORIAS_ESTOQUE.map((c) => ({ valor: c, rotulo: c }))}
          placeholder="Todas as categorias"
          className="sm:w-56 [&_span]:hidden"
        />
      </div>

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum item encontrado"
          mensagem="Cadastre o primeiro item ou ajuste os filtros."
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={[
              'Código',
              'Item',
              'Disponível',
              'Mínimo',
              'Status',
              'Fornecedor',
              'Ações',
            ]}
            chaves={[
              'codigo',
              'descricao',
              'quantidade',
              'quantidadeMinima',
              'status',
              'fornecedor',
              null,
            ]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((i) => {
              const status = statusEstoque(i)
              return (
                <Linha key={i.codigo}>
                  <Celula className="font-mono text-xs font-semibold">{i.codigo}</Celula>
                  <Celula>
                    <p className="font-medium">{i.descricao}</p>
                    <p className="text-xs text-content-muted">{i.categoria}</p>
                  </Celula>
                  <Celula>
                    <span className="font-semibold">
                      {i.quantidade}{' '}
                      <span className="text-xs font-normal text-content-muted">
                        {i.unidade}
                      </span>
                    </span>
                  </Celula>
                  <Celula className="text-xs text-content-muted">
                    {i.quantidadeMinima}
                  </Celula>
                  <Celula>
                    <BadgeStatus status={status} />
                  </Celula>
                  <Celula className="text-xs text-content-muted">
                    {i.fornecedor ?? '—'}
                  </Celula>
                  <Celula>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setHistorico(i)}
                        className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-content"
                        title="Histórico"
                      >
                        <History size={16} />
                      </button>
                      {editar && (
                        <>
                          <button
                            onClick={() => setMovimento({ tipo: 'entrada', codigo: i.codigo })}
                            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-success"
                            title="Registrar entrada"
                          >
                            <ArrowDownToLine size={16} />
                          </button>
                          <button
                            onClick={() => setMovimento({ tipo: 'saida', codigo: i.codigo })}
                            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-danger"
                            title="Registrar saída"
                            disabled={i.quantidade === 0}
                          >
                            <ArrowUpFromLine size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setItemEdicao(i)
                              setModalItem(true)
                            }}
                            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-content"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </Celula>
                </Linha>
              )
            })}
          </tbody>
        </Tabela>
      )}

      {filtrados.length > 0 && (
        <Paginacao
          pagina={pag.pagina}
          totalPaginas={pag.totalPaginas}
          totalItens={filtrados.length}
          exibindoDe={pag.inicio + 1}
          exibindoAte={pag.fim}
          aoMudar={pag.setPagina}
        />
      )}

      <ItemEstoqueModal
        aberto={modalItem}
        aoFechar={() => setModalItem(false)}
        item={itemEdicao}
      />

      {movimento && (
        <MovimentoModal
          aberto
          aoFechar={() => setMovimento(null)}
          tipo={movimento.tipo}
          codigoInicial={movimento.codigo}
        />
      )}

      <Modal
        aberto={!!historico}
        aoFechar={() => setHistorico(null)}
        titulo={`Histórico — ${historico?.codigo ?? ''}`}
        rodape={
          <Botao variante="secundario" onClick={() => setHistorico(null)}>
            Fechar
          </Botao>
        }
      >
        {movimentosHistorico.length === 0 ? (
          <p className="text-sm text-content-muted">
            Nenhuma movimentação para este item.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {movimentosHistorico.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-content">{m.rotulo}</p>
                  <p className="text-xs text-content-muted">
                    {m.id} · {m.usuario}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${m.tom}`}>{m.quantidade}</p>
                  <p className="text-xs text-content-muted">{m.data}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
