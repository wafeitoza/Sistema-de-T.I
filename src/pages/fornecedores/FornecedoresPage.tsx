import { useMemo, useState } from 'react'
import { Pencil, Plus, Power, Search, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Paginacao } from '../../components/ui/Paginacao'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAuthStore } from '../../store/auth'
import { useFornecedoresStore } from '../../store/fornecedores'
import { useUiStore } from '../../store/ui'
import type { Fornecedor } from '../../types'
import { FornecedorFormModal } from './FornecedorFormModal'

export function FornecedoresPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { fornecedores, alternarStatus, excluir } = useFornecedoresStore()
  const notificar = useUiStore((s) => s.notificar)
  const podeEditar = usuario?.perfil === 'Admin' || usuario?.perfil === 'Gerente'

  const [busca, setBusca] = useState('')
  const [modalForm, setModalForm] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Fornecedor | null>(null)
  const [paraExcluir, setParaExcluir] = useState<Fornecedor | null>(null)
  const { ord, ordenar } = useOrdenacao('nome')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return fornecedores
    return fornecedores.filter(
      (f) =>
        f.nome.toLowerCase().includes(termo) ||
        f.cnpj.toLowerCase().includes(termo) ||
        (f.email ?? '').toLowerCase().includes(termo),
    )
  }, [fornecedores, busca])

  const ordenados = ordenarPor(filtrados, ord)
  const pag = usePaginacao(ordenados.length)
  const visiveis = ordenados.slice(pag.inicio, pag.fim)

  function alternar(f: Fornecedor) {
    alternarStatus(f.id)
    notificar(
      'sucesso',
      f.ativo ? `Fornecedor ${f.nome} desativado.` : `Fornecedor ${f.nome} reativado.`,
    )
  }

  function confirmarExclusao() {
    if (!paraExcluir) return
    const resultado = excluir(paraExcluir.id)
    if (!resultado.ok) {
      notificar('erro', resultado.erro ?? 'Não foi possível excluir o fornecedor.')
      setParaExcluir(null)
      return
    }
    notificar('info', `Fornecedor ${paraExcluir.nome} excluído.`)
    setParaExcluir(null)
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          podeEditar ? (
            <Botao
              onClick={() => {
                setEmEdicao(null)
                setModalForm(true)
              }}
            >
              <Plus size={16} /> Novo fornecedor
            </Botao>
          ) : null
        }
      >
        Fornecedores
      </TituloSecao>

      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar razão social, CNPJ ou e-mail…"
          className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum fornecedor encontrado"
          mensagem="Cadastre um novo fornecedor ou ajuste a busca."
          acao={
            podeEditar ? (
              <Botao
                tamanho="sm"
                onClick={() => {
                  setEmEdicao(null)
                  setModalForm(true)
                }}
              >
                <Plus size={14} /> Novo fornecedor
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={[
              'ID',
              'Razão social',
              'CNPJ',
              'E-mail',
              'Telefone',
              'Status',
              'Ações',
            ]}
            chaves={['id', 'nome', 'cnpj', 'email', 'telefone', null, null]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((f) => (
              <Linha key={f.id}>
                <Celula className="whitespace-nowrap font-mono text-xs">{f.id}</Celula>
                <Celula className="text-sm font-medium">{f.nome}</Celula>
                <Celula className="whitespace-nowrap font-mono text-xs">
                  {f.cnpj || '—'}
                </Celula>
                <Celula className="text-xs">{f.email || '—'}</Celula>
                <Celula className="whitespace-nowrap text-xs">{f.telefone || '—'}</Celula>
                <Celula>
                  <Badge tom={f.ativo ? 'success' : 'neutral'}>
                    {f.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Celula>
                <Celula>
                  {podeEditar && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEmEdicao(f)
                          setModalForm(true)
                        }}
                        className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-content"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => alternar(f)}
                        className={`rounded-lg p-1.5 text-content-muted hover:bg-surface-2 ${
                          f.ativo ? 'hover:text-danger' : 'hover:text-success'
                        }`}
                        title={f.ativo ? 'Desativar' : 'Reativar'}
                      >
                        <Power size={16} />
                      </button>
                      <button
                        onClick={() => setParaExcluir(f)}
                        className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-danger"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </Celula>
              </Linha>
            ))}
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

      <FornecedorFormModal
        aberto={modalForm}
        aoFechar={() => setModalForm(false)}
        fornecedor={emEdicao}
      />

      <Modal
        aberto={!!paraExcluir}
        aoFechar={() => setParaExcluir(null)}
        titulo="Excluir fornecedor"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaExcluir(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={confirmarExclusao}>
              Excluir
            </Botao>
          </>
        }
      >
        <p className="text-sm text-content">
          Confirma a exclusão de <strong>{paraExcluir?.nome}</strong>
          {paraExcluir?.cnpj ? <> — CNPJ {paraExcluir.cnpj}</> : null}? A ação é
          irreversível, apaga o cadastro e fica registrada na auditoria. Se o
          fornecedor estiver vinculado a itens de estoque, a exclusão será
          bloqueada — nesse caso, desative-o.
        </p>
      </Modal>
    </div>
  )
}
