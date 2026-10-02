import { useMemo, useState } from 'react'
import { Pencil, Plus, Power, Search } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Paginacao } from '../../components/ui/Paginacao'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAtivosStore } from '../../store/ativos'
import { useAuthStore } from '../../store/auth'
import { useSetoresStore } from '../../store/setores'
import { useUiStore } from '../../store/ui'
import type { Setor } from '../../types'
import { SetorFormModal } from './SetorFormModal'

export function SetoresPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { setores, alternarStatus } = useSetoresStore()
  const ativos = useAtivosStore((s) => s.ativos)
  const notificar = useUiStore((s) => s.notificar)
  const podeEditar = usuario?.perfil === 'Admin' || usuario?.perfil === 'Gerente'

  const [busca, setBusca] = useState('')
  const [modalForm, setModalForm] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Setor | null>(null)
  const { ord, ordenar } = useOrdenacao('nome')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return setores
    return setores.filter(
      (s) =>
        s.nome.toLowerCase().includes(termo) ||
        s.responsavel.toLowerCase().includes(termo) ||
        s.localizacao.toLowerCase().includes(termo),
    )
  }, [setores, busca])

  const ordenados = ordenarPor(filtrados, ord)
  const pag = usePaginacao(ordenados.length)
  const visiveis = ordenados.slice(pag.inicio, pag.fim)

  const contarAtivos = (nome: string) => ativos.filter((a) => a.setor === nome).length

  function alternar(s: Setor) {
    alternarStatus(s.id)
    notificar(
      'sucesso',
      s.ativo ? `Setor ${s.nome} desativado.` : `Setor ${s.nome} reativado.`,
    )
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
              <Plus size={16} /> Novo setor
            </Botao>
          ) : null
        }
      >
        Setores
      </TituloSecao>

      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar setor, responsável ou localização…"
          className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum setor encontrado"
          mensagem="Cadastre um novo setor ou ajuste a busca."
          acao={
            podeEditar ? (
              <Botao
                tamanho="sm"
                onClick={() => {
                  setEmEdicao(null)
                  setModalForm(true)
                }}
              >
                <Plus size={14} /> Novo setor
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={['ID', 'Nome', 'Responsável', 'Localização', 'Ativos', 'Status', 'Ações']}
            chaves={['id', 'nome', 'responsavel', 'localizacao', null, null, null]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((s) => (
              <Linha key={s.id}>
                <Celula className="whitespace-nowrap font-mono text-xs">{s.id}</Celula>
                <Celula className="text-sm font-medium">{s.nome}</Celula>
                <Celula className="text-xs">{s.responsavel || '—'}</Celula>
                <Celula className="text-xs">{s.localizacao || '—'}</Celula>
                <Celula className="text-xs">{contarAtivos(s.nome)}</Celula>
                <Celula>
                  <Badge tom={s.ativo ? 'success' : 'neutral'}>
                    {s.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Celula>
                <Celula>
                  {podeEditar && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEmEdicao(s)
                          setModalForm(true)
                        }}
                        className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-content"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => alternar(s)}
                        className={`rounded-lg p-1.5 text-content-muted hover:bg-surface-2 ${
                          s.ativo ? 'hover:text-danger' : 'hover:text-success'
                        }`}
                        title={s.ativo ? 'Desativar' : 'Reativar'}
                      >
                        <Power size={16} />
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

      <SetorFormModal
        aberto={modalForm}
        aoFechar={() => setModalForm(false)}
        setor={emEdicao}
      />
    </div>
  )
}
