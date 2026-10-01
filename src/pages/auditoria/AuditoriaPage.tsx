import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Entrada, Selecao } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Paginacao } from '../../components/ui/Paginacao'
import { Resumo } from '../../components/ui/Resumo'
import { CabecalhoTabela, Celula, Linha, Tabela } from '../../components/ui/Tabela'
import { lerColecao } from '../../data/repository'
import { descreverDiff } from '../../lib/audit'
import { exportarCSV } from '../../lib/exportar'
import { formatarData, hojeBR } from '../../lib/format'
import { usePaginacao } from '../../lib/tabela'
import { useAuthStore } from '../../store/auth'
import type { AcaoLog, LogEntrada } from '../../types'

const ACOES_PT: Record<AcaoLog, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  IMPORT: 'Importação',
  EXPORT: 'Exportação',
  RESET: 'Restauração',
}

const TOM_ACAO: Record<AcaoLog, 'success' | 'info' | 'danger' | 'neutral' | 'warning' | 'primary'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  IMPORT: 'warning',
  EXPORT: 'warning',
  RESET: 'danger',
}

function formatarHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const OPCOES_ACAO = (Object.keys(ACOES_PT) as AcaoLog[]).map((a) => ({
  valor: a,
  rotulo: ACOES_PT[a],
}))

export function AuditoriaPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const logs = useMemo(() => lerColecao<LogEntrada>('LOG'), [])
  const [filtro, setFiltro] = useState({
    usuario: '',
    tabela: '',
    acao: '',
    de: '',
    ate: '',
  })
  const [expandido, setExpandido] = useState<string | null>(null)

  const usuarios = useMemo(
    () => [...new Set(logs.map((l) => l.usuario))].sort(),
    [logs],
  )
  const tabelas = useMemo(
    () => [...new Set(logs.map((l) => l.tabela))].sort(),
    [logs],
  )

  const filtrados = useMemo(() => {
    return logs.filter((l) => {
      if (filtro.usuario && l.usuario !== filtro.usuario) return false
      if (filtro.tabela && l.tabela !== filtro.tabela) return false
      if (filtro.acao && l.acao !== filtro.acao) return false
      const dia = l.dataHora.slice(0, 10)
      if (filtro.de && dia < filtro.de) return false
      if (filtro.ate && dia > filtro.ate) return false
      return true
    })
  }, [logs, filtro])

  const pag = usePaginacao(filtrados.length, 15)
  const visiveis = filtrados.slice(pag.inicio, pag.fim)

  const alteracoes = filtrados.filter((l) => l.acao === 'UPDATE').length
  const criacoes = filtrados.filter((l) => l.acao === 'CREATE').length
  const erros = filtrados.filter((l) => l.resultado === 'Erro').length

  function exportar() {
    exportarCSV(
      'auditoria.csv',
      [
        'Data',
        'Hora',
        'Usuário',
        'Ação',
        'Tabela',
        'Registro',
        'Resultado',
        'Mensagem',
        'Alterações',
      ],
      filtrados.map((l) => [
        formatarData(l.dataHora),
        formatarHora(l.dataHora),
        l.usuario,
        ACOES_PT[l.acao] ?? l.acao,
        l.tabela,
        l.registroId,
        l.resultado,
        l.mensagem ?? '',
        l.campos.map(descreverDiff).join(' | '),
      ]),
      [
        `Auditoria exportada por ${usuario?.email ?? '—'}`,
        `Filtros: usuário=${filtro.usuario || 'todos'} · tabela=${filtro.tabela || 'todas'} · ação=${filtro.acao ? ACOES_PT[filtro.acao as AcaoLog] : 'todas'} · período=${filtro.de || '…'} a ${filtro.ate || '…'}`,
        `Data da exportação: ${hojeBR()} · Registros: ${filtrados.length}`,
      ],
    )
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          <Botao onClick={exportar} disabled={!filtrados.length}>
            <Download size={16} /> Exportar CSV
          </Botao>
        }
      >
        Auditoria
      </TituloSecao>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Registros" valor={filtrados.length} />
        <Resumo titulo="Alterações" valor={alteracoes} />
        <Resumo titulo="Criações" valor={criacoes} />
        <Resumo titulo="Erros" valor={erros} destaque={erros > 0} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selecao
          label="Usuário"
          value={filtro.usuario}
          onChange={(e) => setFiltro({ ...filtro, usuario: e.target.value })}
          opcoes={usuarios.map((u) => ({ valor: u, rotulo: u }))}
          placeholder="Todos"
        />
        <Selecao
          label="Tabela"
          value={filtro.tabela}
          onChange={(e) => setFiltro({ ...filtro, tabela: e.target.value })}
          opcoes={tabelas.map((t) => ({ valor: t, rotulo: t }))}
          placeholder="Todas"
        />
        <Selecao
          label="Ação"
          value={filtro.acao}
          onChange={(e) => setFiltro({ ...filtro, acao: e.target.value })}
          opcoes={OPCOES_ACAO}
          placeholder="Todas"
        />
        <div className="grid grid-cols-2 gap-3">
          <Entrada
            label="De"
            type="date"
            value={filtro.de}
            onChange={(e) => setFiltro({ ...filtro, de: e.target.value })}
          />
          <Entrada
            label="Até"
            type="date"
            value={filtro.ate}
            onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })}
          />
        </div>
      </div>

      {filtrados.length ? (
        <>
          <Tabela>
            <CabecalhoTabela
              colunas={[
                'Data',
                'Hora',
                'Usuário',
                'Ação',
                'Tabela',
                'Registro',
                'Resumo',
                '',
              ]}
            />
            <tbody>
              {visiveis.map((l) => {
                const temDetalhes = l.campos.length > 0 || !!l.mensagem
                const aberto = expandido === l.id
                return (
                  <Fragment key={l.id}>
                    <Linha>
                      <Celula className="whitespace-nowrap text-xs">
                        {formatarData(l.dataHora)}
                      </Celula>
                      <Celula className="whitespace-nowrap text-xs">
                        {formatarHora(l.dataHora)}
                      </Celula>
                      <Celula className="text-xs">{l.usuario}</Celula>
                      <Celula>
                        <Badge tom={TOM_ACAO[l.acao]}>
                          {ACOES_PT[l.acao] ?? l.acao}
                        </Badge>
                      </Celula>
                      <Celula className="text-xs">{l.tabela}</Celula>
                      <Celula className="text-xs">{l.registroId}</Celula>
                      <Celula className="max-w-[22rem] truncate text-xs text-content-muted">
                        {l.mensagem ??
                          (l.campos[0] ? descreverDiff(l.campos[0]) : '—')}
                      </Celula>
                      <Celula className="text-right">
                        {temDetalhes ? (
                          <button
                            onClick={() => setExpandido(aberto ? null : l.id)}
                            className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
                            aria-label={
                              aberto ? 'Recolher detalhes' : 'Ver detalhes'
                            }
                            title={aberto ? 'Recolher' : 'Ver detalhes'}
                          >
                            {aberto ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </button>
                        ) : null}
                      </Celula>
                    </Linha>
                    {aberto && (
                      <tr className="bg-surface-2/60">
                        <Celula colSpan={8}>
                          <div className="flex flex-col gap-1.5 py-1">
                            <p className="text-xs font-semibold text-content">
                              {l.id}
                              {l.mensagem ? ` — ${l.mensagem}` : ''}
                            </p>
                            {l.campos.map((c, i) => (
                              <p
                                key={i}
                                className="font-mono text-xs text-content-muted"
                              >
                                {descreverDiff(c)}
                              </p>
                            ))}
                            {!l.campos.length && !l.mensagem && (
                              <p className="text-xs text-content-muted">
                                Sem alterações de campos.
                              </p>
                            )}
                          </div>
                        </Celula>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </Tabela>
          <Paginacao
            pagina={pag.pagina}
            totalPaginas={pag.totalPaginas}
            totalItens={filtrados.length}
            exibindoDe={pag.inicio + 1}
            exibindoAte={pag.fim}
            aoMudar={pag.setPagina}
          />
        </>
      ) : (
        <EstadoVazio
          titulo="Nenhum registro encontrado"
          mensagem="Ajuste os filtros para encontrar registros de auditoria."
        />
      )}
    </div>
  )
}
