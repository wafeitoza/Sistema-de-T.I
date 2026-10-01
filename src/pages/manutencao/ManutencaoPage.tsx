import { useMemo, useState } from 'react'
import { CalendarPlus, CheckCircle2, Play, Plus, XCircle } from 'lucide-react'
import { BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { AreaTexto, CampoMoeda, Entrada, Selecao } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Paginacao } from '../../components/ui/Paginacao'
import { Resumo } from '../../components/ui/Resumo'
import { Celula, CabecalhoTabela, Linha, Tabela } from '../../components/ui/Tabela'
import { lerColecao } from '../../data/repository'
import { diasAte, formatarData, parseMoeda } from '../../lib/format'
import { podeEditar } from '../../lib/permissions'
import { ordenarPor, useOrdenacao, usePaginacao } from '../../lib/tabela'
import { useAtivosStore } from '../../store/ativos'
import { useAuthStore } from '../../store/auth'
import { useManutencoesStore } from '../../store/manutencao'
import { useUiStore } from '../../store/ui'
import type { Manutencao, StatusManutencao, TipoManutencao, Usuario } from '../../types'

const STATUS: StatusManutencao[] = ['Agendada', 'Em Execução', 'Concluída', 'Cancelada']
const TIPOS: TipoManutencao[] = ['Preventiva', 'Corretiva', 'Inspeção']

export function ManutencaoPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const { manutencoes, agendar, iniciar, concluir, cancelar } = useManutencoesStore()
  const { ativos } = useAtivosStore()
  const notificar = useUiStore((s) => s.notificar)
  const editar = podeEditar(usuario?.perfil ?? 'Visualizador')

  const [filtro, setFiltro] = useState('')
  const [modalNova, setModalNova] = useState(false)
  const [paraConcluir, setParaConcluir] = useState<Manutencao | null>(null)
  const [paraCancelar, setParaCancelar] = useState<Manutencao | null>(null)

  const [form, setForm] = useState({
    codigoAtivo: '',
    tipo: 'Preventiva' as TipoManutencao,
    dataAgendada: '',
    tecnico: '',
    descricao: '',
  })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [resultadoConclusao, setResultadoConclusao] = useState('OK')
  const [custo, setCusto] = useState('')
  const { ord, ordenar } = useOrdenacao('dataAgendada')

  const usuarios = lerColecao<Usuario>('USUARIOS').filter((u) => u.status === 'Ativo')
  const ativosDisponiveis = ativos.filter((a) => a.status !== 'Descartado')

  const lista = useMemo(
    () =>
      manutencoes.filter(
        (m) => !filtro || m.status === filtro,
      ),
    [manutencoes, filtro],
  )

  const pag = usePaginacao(lista.length)
  const visiveis = useMemo(
    () => ordenarPor(lista, ord).slice(pag.inicio, pag.fim),
    [lista, ord, pag.inicio, pag.fim],
  )

  const agendadas = manutencoes.filter((m) => m.status === 'Agendada')
  const emExecucao = manutencoes.filter((m) => m.status === 'Em Execução')
  const urgentes = agendadas.filter((m) => {
    const d = diasAte(m.dataAgendada)
    return d !== null && d <= 5
  })

  function abrirNova() {
    setForm({
      codigoAtivo: ativosDisponiveis[0]?.codigo ?? '',
      tipo: 'Preventiva',
      dataAgendada: '',
      tecnico: usuario?.email ?? '',
      descricao: '',
    })
    setErros({})
    setModalNova(true)
  }

  function salvarAgendamento() {
    const novosErros: Record<string, string> = {}
    if (!form.codigoAtivo) novosErros.codigoAtivo = 'Selecione um ativo'
    if (!form.dataAgendada) novosErros.dataAgendada = 'Informe a data'
    if (!form.tecnico) novosErros.tecnico = 'Selecione o técnico'
    if (form.descricao.trim().length < 5) {
      novosErros.descricao = 'Descreva o trabalho a ser feito'
    }
    if (Object.keys(novosErros).length) {
      setErros(novosErros)
      return
    }
    agendar({
      codigoAtivo: form.codigoAtivo,
      tipo: form.tipo,
      dataAgendada: form.dataAgendada,
      tecnico: form.tecnico,
      descricao: form.descricao.trim(),
    })
    setModalNova(false)
    notificar('sucesso', 'Manutenção agendada. O ativo foi colocado em status Manutenção.')
  }

  function confirmarConclusao() {
    if (!paraConcluir) return
    concluir(paraConcluir.id, {
      resultado: resultadoConclusao,
      custo: parseMoeda(custo),
    })
    setParaConcluir(null)
    setCusto('')
    notificar(
      'sucesso',
      'Manutenção concluída. Próxima preventiva calculada para +90 dias.',
    )
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          editar ? (
            <Botao onClick={abrirNova}>
              <Plus size={16} /> Agendar manutenção
            </Botao>
          ) : null
        }
      >
        Manutenção
      </TituloSecao>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Agendadas" valor={agendadas.length} />
        <Resumo titulo="Em execução" valor={emExecucao.length} />
        <Resumo titulo="Vencem em ≤ 5 dias" valor={urgentes.length} destaque={urgentes.length > 0} />
        <Resumo
          titulo="Concluídas"
          valor={manutencoes.filter((m) => m.status === 'Concluída').length}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFiltro('')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            filtro === '' ? 'bg-primary text-white' : 'border border-line bg-surface text-content-muted'
          }`}
        >
          Todas
        </button>
        {STATUS.map((s) => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === s
                ? 'bg-primary text-white'
                : 'border border-line bg-surface text-content-muted'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma manutenção"
          mensagem="Agende a primeira manutenção preventiva ou corretiva."
          acao={
            editar ? (
              <Botao tamanho="sm" onClick={abrirNova}>
                <Plus size={14} /> Agendar
              </Botao>
            ) : null
          }
        />
      ) : (
        <Tabela>
          <CabecalhoTabela
            colunas={['ID', 'Ativo', 'Tipo', 'Data agendada', 'Técnico', 'Status', 'Ações']}
            chaves={[
              'id',
              'codigoAtivo',
              'tipo',
              'dataAgendada',
              'tecnico',
              'status',
              null,
            ]}
            ord={ord}
            aoOrdenar={ordenar}
          />
          <tbody>
            {visiveis.map((m) => {
              const dias = diasAte(m.dataAgendada)
              const atrasada =
                dias !== null && dias < 0 && (m.status === 'Agendada' || m.status === 'Em Execução')
              const urgente =
                dias !== null && dias >= 0 && dias <= 5 && m.status === 'Agendada'
              return (
                <Linha key={m.id}>
                  <Celula className="whitespace-nowrap font-mono text-xs font-semibold">
                    {m.id}
                  </Celula>
                  <Celula className="text-sm font-medium">{m.codigoAtivo}</Celula>
                  <Celula className="text-xs">{m.tipo}</Celula>
                  <Celula>
                    <p className="text-sm">{formatarData(m.dataAgendada)}</p>
                    <p
                      className={`text-xs ${
                        atrasada ? 'text-danger' : urgente ? 'text-warning' : 'text-content-muted'
                      }`}
                    >
                      {m.status === 'Concluída' && m.dataRealizada
                        ? `realizada em ${m.dataRealizada}`
                        : dias !== null && dias >= 0
                          ? `em ${dias} dia(s)`
                          : dias !== null
                            ? 'atrasada'
                            : ''}
                    </p>
                  </Celula>
                  <Celula className="text-xs">{m.tecnico}</Celula>
                  <Celula>
                    <BadgeStatus status={m.status} />
                  </Celula>
                  <Celula>
                    {editar && (
                      <div className="flex items-center gap-1">
                        {m.status === 'Agendada' && (
                          <button
                            onClick={() => iniciar(m.id)}
                            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 hover:text-primary"
                            title="Iniciar execução"
                          >
                            <Play size={16} />
                          </button>
                        )}
                        {(m.status === 'Agendada' || m.status === 'Em Execução') && (
                          <>
                            <button
                              onClick={() => setParaConcluir(m)}
                              className="rounded-lg p-1.5 text-content-muted hover:bg-success/15 hover:text-success"
                              title="Concluir"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => setParaCancelar(m)}
                              className="rounded-lg p-1.5 text-content-muted hover:bg-danger/15 hover:text-danger"
                              title="Cancelar"
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

      <Modal
        aberto={modalNova}
        aoFechar={() => setModalNova(false)}
        titulo="Agendar manutenção"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModalNova(false)}>
              Cancelar
            </Botao>
            <Botao onClick={salvarAgendamento}>Agendar</Botao>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Selecao
            label="Ativo *"
            value={form.codigoAtivo}
            erro={erros.codigoAtivo}
            onChange={(e) => setForm({ ...form, codigoAtivo: e.target.value })}
            opcoes={ativosDisponiveis.map((a) => ({
              valor: a.codigo,
              rotulo: `${a.codigo} — ${a.descricao}`,
            }))}
            placeholder="Selecione…"
            className="sm:col-span-2"
          />
          <Selecao
            label="Tipo"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoManutencao })}
            opcoes={TIPOS.map((t) => ({ valor: t, rotulo: t }))}
          />
          <Entrada
            label="Data agendada *"
            value={form.dataAgendada}
            erro={erros.dataAgendada}
            onChange={(e) => setForm({ ...form, dataAgendada: e.target.value })}
            placeholder="DD/MM/AAAA"
            inputMode="numeric"
          />
          <Selecao
            label="Técnico responsável *"
            value={form.tecnico}
            erro={erros.tecnico}
            onChange={(e) => setForm({ ...form, tecnico: e.target.value })}
            opcoes={usuarios.map((u) => ({ valor: u.email, rotulo: u.nome }))}
            placeholder="Selecione…"
            className="sm:col-span-2"
          />
          <AreaTexto
            label="Descrição do trabalho *"
            value={form.descricao}
            erro={erros.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Limpeza interna, troca de pasta térmica…"
            className="sm:col-span-2"
          />
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-primary-light px-3 py-2 text-xs text-primary dark:bg-primary/10">
          <CalendarPlus size={14} className="mt-0.5 shrink-0" />
          Ao agendar, o ativo muda para status <strong>Manutenção</strong>.
        </p>
      </Modal>

      <Modal
        aberto={!!paraConcluir}
        aoFechar={() => setParaConcluir(null)}
        titulo={`Concluir ${paraConcluir?.id ?? ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaConcluir(null)}>
              Cancelar
            </Botao>
            <Botao onClick={confirmarConclusao}>Concluir manutenção</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Selecao
            label="Resultado"
            value={resultadoConclusao}
            onChange={(e) => setResultadoConclusao(e.target.value)}
            opcoes={['OK', 'Falha', 'Componente Substituído', 'Fora de garantia'].map(
              (r) => ({ valor: r, rotulo: r }),
            )}
          />
          <CampoMoeda
            label="Custo"
            valor={custo}
            aoMudar={setCusto}
            placeholder="0,00"
          />
          <p className="text-xs text-content-muted">
            Ao concluir, o ativo volta para <strong>Ativo</strong> e a próxima manutenção
            preventiva é calculada (+90 dias).
          </p>
        </div>
      </Modal>

      <Modal
        aberto={!!paraCancelar}
        aoFechar={() => setParaCancelar(null)}
        titulo="Cancelar manutenção"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaCancelar(null)}>
              Voltar
            </Botao>
            <Botao
              variante="perigo"
              onClick={() => {
                if (paraCancelar) {
                  cancelar(paraCancelar.id)
                  notificar('info', 'Manutenção cancelada.')
                }
                setParaCancelar(null)
              }}
            >
              Cancelar manutenção
            </Botao>
          </>
        }
      >
        <p className="text-sm text-content">
          Cancelar a manutenção <strong>{paraCancelar?.id}</strong> ({paraCancelar?.codigoAtivo}
          )? O ativo volta para o status Ativo.
        </p>
      </Modal>
    </div>
  )
}
