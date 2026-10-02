import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Minus } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { Entrada } from '../../components/ui/Campos'
import { Modal } from '../../components/ui/Modal'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { useEstoqueStore } from '../../store/estoque'
import { useInventarioStore } from '../../store/inventario'
import { useUiStore } from '../../store/ui'
import type { Contagem } from '../../types'

export function NovaContagemModal({
  aberto,
  aoFechar,
}: {
  aberto: boolean
  aoFechar: () => void
}) {
  const itens = useEstoqueStore((s) => s.itens)
  const criarContagem = useInventarioStore((s) => s.criarContagem)
  const notificar = useUiStore((s) => s.notificar)
  const [nome, setNome] = useState('')
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [erro, setErro] = useState('')

  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto) {
      setNome('')
      setErro('')
      setSelecionados(itens.map((i) => i.codigo))
    }
  }

  function alternar(codigo: string) {
    setSelecionados((atual) =>
      atual.includes(codigo) ? atual.filter((c) => c !== codigo) : [...atual, codigo],
    )
  }

  function salvar() {
    if (!nome.trim()) return setErro('Informe um nome para a contagem')
    if (selecionados.length === 0) return setErro('Selecione ao menos um item')
    const contagem = criarContagem(nome, selecionados)
    if (!contagem) return setErro('Não foi possível criar a contagem')
    notificar('sucesso', `Contagem ${contagem.id} criada com ${selecionados.length} itens.`)
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova contagem de estoque"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar}>Criar contagem</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Entrada
          label="Nome da contagem *"
          value={nome}
          erro={erro && !nome.trim() ? erro : undefined}
          onChange={(e) => {
            setNome(e.target.value)
            setErro('')
          }}
          placeholder="Contagem cíclica — setor TI"
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted">
              Itens a contar ({selecionados.length}/{itens.length})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelecionados(itens.map((i) => i.codigo))}
                className="text-xs text-primary hover:underline"
              >
                Todos
              </button>
              <button
                onClick={() => setSelecionados([])}
                className="text-xs text-content-muted hover:underline"
              >
                Nenhum
              </button>
            </div>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
            {itens.map((i) => {
              const marcado = selecionados.includes(i.codigo)
              return (
                <label
                  key={i.codigo}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    marcado ? 'bg-primary/10' : 'hover:bg-surface-2'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(i.codigo)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="font-mono text-xs font-semibold">{i.codigo}</span>
                  <span className="flex-1 truncate text-content">{i.descricao}</span>
                  <span className="text-xs text-content-muted">
                    {i.quantidade} {i.unidade}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {erro && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

export function ContagemDetalheModal({
  aberto,
  aoFechar,
  contagem,
  podeEditar,
}: {
  aberto: boolean
  aoFechar: () => void
  contagem: Contagem | null
  podeEditar: boolean
}) {
  const itens = useEstoqueStore((s) => s.itens)
  const registrarContagem = useInventarioStore((s) => s.registrarContagem)
  const concluirContagem = useInventarioStore((s) => s.concluirContagem)
  const excluirContagem = useInventarioStore((s) => s.excluirContagem)
  const notificar = useUiStore((s) => s.notificar)
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({})
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState('')

  const aberta = contagem?.status === 'Em andamento'

  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto && contagem) {
      setConfirmar(false)
      setErro('')
      setRascunhos(
        Object.fromEntries(
          contagem.itens.map((i) => [i.codigoItem, i.contado === null ? '' : String(i.contado)]),
        ),
      )
    }
  }

  const linhas = useMemo(() => {
    if (!contagem) return []
    return contagem.itens.map((ic) => {
      const item = itens.find((i) => i.codigo === ic.codigoItem)
      const texto = rascunhos[ic.codigoItem] ?? (ic.contado === null ? '' : String(ic.contado))
      const contado = texto.trim() === '' ? null : Number(texto)
      const valido = contado === null || (!Number.isNaN(contado) && contado >= 0 && Number.isInteger(contado))
      const divergente = valido && contado !== null && item !== undefined && contado !== item.quantidade
      return { ic, item, texto, contado, valido, divergente }
    })
  }, [contagem, itens, rascunhos])

  const contados = linhas.filter((l) => l.contado !== null && l.valido).length
  const divergentes = linhas.filter((l) => l.divergente).length
  const invalidos = linhas.filter((l) => !l.valido).length

  function salvarLinha(codigoItem: string, texto: string) {
    if (!contagem) return
    if (texto.trim() === '') {
      registrarContagem(contagem.id, codigoItem, null)
      return
    }
    const numero = Number(texto)
    const resultado = registrarContagem(contagem.id, codigoItem, numero)
    if (!resultado.ok) notificar('erro', resultado.erro ?? 'Falha ao registrar contagem')
  }

  function concluir() {
    if (!contagem) return
    if (invalidos > 0) return setErro('Corrija as quantidades inválidas antes de concluir')
    const resultado = concluirContagem(contagem.id)
    if (!resultado.ok) return setErro(resultado.erro ?? 'Falha ao concluir')
    notificar(
      'sucesso',
      `Contagem ${contagem.id} concluída: ${resultado.divergentes} divergência(s), ${resultado.ajustes} ajuste(s) aplicado(s).`,
    )
    aoFechar()
  }

  function excluir() {
    if (!contagem) return
    if (excluirContagem(contagem.id)) {
      notificar('info', `Contagem ${contagem.id} excluída.`)
      aoFechar()
    } else {
      setErro('Não foi possível excluir esta contagem')
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Contagem ${contagem?.id ?? ''} — ${contagem?.nome ?? ''}`}
      largo
      rodape={
        confirmar ? (
          <>
            <Botao variante="secundario" onClick={() => setConfirmar(false)}>
              Voltar
            </Botao>
            <Botao onClick={concluir}>
              <Check size={16} /> Confirmar conclusão
            </Botao>
          </>
        ) : (
          <>
            {aberta && podeEditar && (
              <Botao variante="perigo" onClick={excluir} className="mr-auto">
                Excluir
              </Botao>
            )}
            <Botao variante="secundario" onClick={aoFechar}>
              Fechar
            </Botao>
            {aberta && podeEditar && (
              <Botao onClick={() => setConfirmar(true)} disabled={contados === 0}>
                Concluir contagem
              </Botao>
            )}
          </>
        )
      }
    >
      {contagem && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-content-muted">
            <span>Status: <strong className="text-content">{contagem.status}</strong></span>
            <span>Criada em: {contagem.data}</span>
            <span>Responsável: {contagem.responsavel}</span>
            <span>
              Contados: <strong className="text-content">{contados}/{linhas.length}</strong>
            </span>
          </div>

          {confirmar && (
            <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-content">
              <AlertTriangle size={16} className="shrink-0 text-warning" />
              <p>
                Ao confirmar, os <strong>{divergentes} item(ns) divergentes</strong> terão o saldo
                do estoque ajustado para o valor contado (com registro em auditoria e
                movimentações). Itens não contados ({linhas.length - contados}) ficam sem ajuste.
                Esta ação não pode ser desfeita.
              </p>
            </div>
          )}

          <Tabela>
            <CabecalhoTabela
              colunas={['Item', 'Saldo sistema', 'Contado', 'Divergência', 'Situação']}
            />
            <tbody>
              {linhas.map((l) => (
                <Linha key={l.ic.codigoItem}>
                  <Celula>
                    <p className="font-medium">{l.item?.descricao ?? l.ic.codigoItem}</p>
                    <p className="font-mono text-xs text-content-muted">{l.ic.codigoItem}</p>
                  </Celula>
                  <Celula className="font-semibold">
                    {l.item ? `${l.item.quantidade} ${l.item.unidade}` : '—'}
                  </Celula>
                  <Celula>
                    <input
                      value={l.texto}
                      onChange={(e) =>
                        setRascunhos((r) => ({ ...r, [l.ic.codigoItem]: e.target.value }))
                      }
                      onBlur={(e) => salvarLinha(l.ic.codigoItem, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          salvarLinha(l.ic.codigoItem, e.currentTarget.value)
                        }
                      }}
                      type="number"
                      min="0"
                      step="1"
                      disabled={!aberta || !podeEditar}
                      placeholder="—"
                      className={`h-9 w-24 rounded-lg border bg-surface px-3 text-sm focus:outline-none focus:ring-2 disabled:opacity-60 ${
                        !l.valido
                          ? 'border-danger text-danger focus:ring-danger/30'
                          : 'border-line text-content focus:border-primary focus:ring-primary/30'
                      }`}
                    />
                  </Celula>
                  <Celula>
                    {!l.valido ? (
                      <span className="text-xs font-semibold text-danger">Inválido</span>
                    ) : l.contado === null ? (
                      <span className="text-content-muted">—</span>
                    ) : (
                      <span
                        className={`text-sm font-semibold ${
                          l.divergente ? 'text-danger' : 'text-success'
                        }`}
                      >
                        {l.divergente ? (
                          `${l.contado - (l.item?.quantidade ?? 0) > 0 ? '+' : ''}${
                            l.contado - (l.item?.quantidade ?? 0)
                          }`
                        ) : (
                          <Minus size={14} />
                        )}
                      </span>
                    )}
                  </Celula>
                  <Celula>
                    {l.ic.contado === null ? (
                      <Badge tom="neutral">Pendente</Badge>
                    ) : l.divergente ? (
                      <Badge tom="danger">Divergente</Badge>
                    ) : (
                      <Badge tom="success">Confere</Badge>
                    )}
                  </Celula>
                </Linha>
              ))}
            </tbody>
          </Tabela>

          {erro && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {erro}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
