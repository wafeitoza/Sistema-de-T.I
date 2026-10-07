import { useMemo, useState } from 'react'
import { CheckCircle2, Handshake, Plus, Search, XCircle } from 'lucide-react'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { AreaTexto } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Paginacao } from '../../components/ui/Paginacao'
import { Resumo } from '../../components/ui/Resumo'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { diasAte, formatarData } from '../../lib/format'
import { podeEditar } from '../../lib/permissions'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAtivosStore } from '../../store/ativos'
import { useAuthStore } from '../../store/auth'
import { emprestimoAtrasado, useEmprestimosStore } from '../../store/emprestimos'
import { useUiStore } from '../../store/ui'
import type { Emprestimo } from '../../types'
import { EmprestimoFormModal } from './EmprestimoFormModal'

const FILTROS = ['Em aberto', 'Atrasado', 'Devolvido', 'Cancelado'] as const

export function EmprestimosPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { emprestimos, devolver, cancelar } = useEmprestimosStore()
  const { ativos } = useAtivosStore()
  const notificar = useUiStore((s) => s.notificar)
  const editar = podeEditar(usuario?.perfil ?? 'Visualizador')

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [paraDevolver, setParaDevolver] = useState<Emprestimo | null>(null)
  const [paraCancelar, setParaCancelar] = useState<Emprestimo | null>(null)
  const [observacaoDevolucao, setObservacaoDevolucao] = useState('')
  const { ord, ordenar } = useOrdenacao('previsaoDevolucao', 'desc')

  const porCodigo = useMemo(() => {
    const mapa = new Map(ativos.map((a) => [a.codigo, a]))
    return (codigo: string) => mapa.get(codigo)
  }, [ativos])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return emprestimos.filter((e) => {
      const ativo = porCodigo(e.codigoAtivo)
      const alvo = `${e.id} ${e.codigoAtivo} ${ativo?.descricao ?? ''} ${e.funcionario} ${e.setor} ${e.matricula ?? ''}`.toLowerCase()
      if (t && !alvo.includes(t)) return false
      if (!filtro) return true
      if (filtro === 'Atrasado') return emprestimoAtrasado(e)
      return e.status === filtro
    })
  }, [emprestimos, busca, filtro, porCodigo])

  const pag = usePaginacao(lista.length)
  const visiveis = useMemo(
    () => ordenarPor(lista, ord).slice(pag.inicio, pag.fim),
    [lista, ord, pag.inicio, pag.fim],
  )

  const emAberto = emprestimos.filter((e) => e.status === 'Em aberto')
  const atrasados = emprestimos.filter(emprestimoAtrasado)
  const devolvidos = emprestimos.filter((e) => e.status === 'Devolvido')

  function confirmarDevolucao() {
    if (!paraDevolver) return
    const r = devolver(paraDevolver.id, observacaoDevolucao)
    if (!r.ok) {
      notificar('erro', r.erro ?? 'Não foi possível registrar a devolução.')
    } else {
      notificar('sucesso', `${paraDevolver.codigoAtivo} devolvido por ${paraDevolver.funcionario}.`)
    }
    setParaDevolver(null)
    setObservacaoDevolucao('')
  }

  function confirmarCancelamento() {
    if (!paraCancelar) return
    const r = cancelar(paraCancelar.id)
    if (!r.ok) {
      notificar('erro', r.erro ?? 'Não foi possível cancelar.')
    } else {
      notificar('info', `Empréstimo ${paraCancelar.id} cancelado.`)
    }
    setParaCancelar(null)
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          editar ? (
            <Botao onClick={() => setModalNovo(true)}>
              <Plus size={16} /> Novo empréstimo
            </Botao>
          ) : null
        }
      >
        Empréstimos de Equipamentos
      </TituloSecao>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Em aberto" valor={emAberto.length} icone={<Handshake size={16} />} />
        <Resumo
          titulo="Atrasados"
          valor={atrasados.length}
          destaque={atrasados.length > 0}
          icone={<XCircle size={16} />}
        />
        <Resumo titulo="Devolvidos" valor={devolvidos.length} icone={<CheckCircle2 size={16} />} />
        <Resumo titulo="Total" valor={emprestimos.length} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por funcionário, equipamento, setor ou ID…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          onClick={() => setFiltro('')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            filtro === ''
              ? 'bg-primary text-white'
              : 'border border-line bg-surface text-content-muted'
          }`}
        >
          Todos
        </button>
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === f
                ? 'bg-primary text-white'
                : 'border border-line bg-surface text-content-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum empréstimo"
          mensagem={
            emprestimos.length
              ? 'Nenhum registro corresponde aos filtros aplicados.'
              : 'Registre o empréstimo de um equipamento para uso pessoal.'
          }
          acao={
            editar && !emprestimos.length ? (
              <Botao tamanho="sm" onClick={() => setModalNovo(true)}>
                <Plus size={14} /> Novo empréstimo
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={['ID', 'Equipamento', 'Funcionário', 'Empréstimo', 'Previsão', 'Status', 'Ações']}
            chaves={['id', 'codigoAtivo', 'funcionario', 'dataEmprestimo', 'previsaoDevolucao', 'status', null]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((e) => {
              const ativo = porCodigo(e.codigoAtivo)
              const atrasado = emprestimoAtrasado(e)
              const dias = diasAte(e.previsaoDevolucao)
              return (
                <Linha key={e.id}>
                  <Celula className="whitespace-nowrap font-mono text-xs font-semibold">
                    {e.id}
                  </Celula>
                  <Celula>
                    <p className="text-sm font-medium">{e.codigoAtivo}</p>
                    <p className="text-xs text-content-muted">
                      {ativo?.descricao ?? 'Fora do cadastro'}
                    </p>
                  </Celula>
                  <Celula>
                    <p className="text-sm font-medium">{e.funcionario}</p>
                    <p className="text-xs text-content-muted">
                      {e.setor}
                      {e.matricula ? ` · mat. ${e.matricula}` : ''}
                    </p>
                  </Celula>
                  <Celula className="whitespace-nowrap text-sm">
                    {formatarData(e.dataEmprestimo)}
                  </Celula>
                  <Celula className="whitespace-nowrap">
                    <p className="text-sm">{formatarData(e.previsaoDevolucao)}</p>
                    {e.status === 'Em aberto' && (
                      <p className={`text-xs ${atrasado ? 'text-danger' : 'text-content-muted'}`}>
                        {atrasado
                          ? `atrasada há ${Math.abs(dias ?? 0)} dia(s)`
                          : dias !== null
                            ? `em ${dias} dia(s)`
                            : ''}
                      </p>
                    )}
                    {e.status === 'Devolvido' && e.dataDevolucao && (
                      <p className="text-xs text-success">devolvido em {e.dataDevolucao}</p>
                    )}
                  </Celula>
                  <Celula>
                    <div className="flex flex-wrap items-center gap-1">
                      <BadgeStatus status={e.status} />
                      {atrasado && <Badge tom="danger">Atrasado</Badge>}
                    </div>
                  </Celula>
                  <Celula>
                    {editar && (
                      <div className="flex items-center gap-1">
                        {e.status === 'Em aberto' && (
                          <>
                            <button
                              onClick={() => {
                                setObservacaoDevolucao('')
                                setParaDevolver(e)
                              }}
                              className="rounded-lg p-1.5 text-content-muted hover:bg-success/15 hover:text-success"
                              title="Registrar devolução"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => setParaCancelar(e)}
                              className="rounded-lg p-1.5 text-content-muted hover:bg-danger/15 hover:text-danger"
                              title="Cancelar empréstimo"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </Celula>
                </Linha>
              )
            })}
          </tbody>
        </Tabela>
      )}

      {lista.length > 0 && (
        <Paginacao
          pagina={pag.pagina}
          totalPaginas={pag.totalPaginas}
          totalItens={lista.length}
          exibindoDe={pag.inicio + 1}
          exibindoAte={pag.fim}
          aoMudar={pag.setPagina}
        />
      )}

      <EmprestimoFormModal aberto={modalNovo} aoFechar={() => setModalNovo(false)} />

      <Modal
        aberto={!!paraDevolver}
        aoFechar={() => setParaDevolver(null)}
        titulo={`Devolver ${paraDevolver?.codigoAtivo ?? ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaDevolver(null)}>
              Voltar
            </Botao>
            <Botao onClick={confirmarDevolucao}>Confirmar devolução</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            Empréstimo de <strong>{paraDevolver?.funcionario}</strong> ({paraDevolver?.setor}),
            previsto para {formatarData(paraDevolver?.previsaoDevolucao)}.
          </p>
          <AreaTexto
            label="Estado do equipamento na devolução"
            value={observacaoDevolucao}
            onChange={(e) => setObservacaoDevolucao(e.target.value)}
            placeholder="Sem avarias, com carregador e mochila…"
          />
          <p className="text-xs text-content-muted">
            A data de devolução será registrada como hoje e o empréstimo ficará{' '}
            <strong>Devolvido</strong>.
          </p>
        </div>
      </Modal>

      <Modal
        aberto={!!paraCancelar}
        aoFechar={() => setParaCancelar(null)}
        titulo={`Cancelar ${paraCancelar?.id ?? ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaCancelar(null)}>
              Voltar
            </Botao>
            <Botao variante="perigo" onClick={confirmarCancelamento}>
              Cancelar empréstimo
            </Botao>
          </>
        }
      >
        <p className="text-sm text-content-muted">
          O empréstimo de <strong>{paraCancelar?.funcionario}</strong> para{' '}
          <strong>{paraCancelar?.codigoAtivo}</strong> será marcado como{' '}
          <strong>Cancelado</strong>. Use isto para corrigir um lançamento incorreto.
        </p>
      </Modal>
    </div>
  )
}
