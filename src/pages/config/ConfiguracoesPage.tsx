import { useState, type ChangeEvent } from 'react'
import {
  Database,
  Download,
  Moon,
  RotateCcw,
  Sun,
  Upload,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { Card, TituloSecao } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { registrarLog } from '../../lib/audit'
import {
  COLECOES_BACKUP,
  type Backup,
  aplicarBackup,
  baixarBackup,
  gerarBackup,
  restaurarDemo,
  validarBackup,
} from '../../lib/backup'
import { modoSupabase } from '../../data/client'
import { lerColecao } from '../../data/repository'
import { useAtivosStore } from '../../store/ativos'
import { useAuthStore } from '../../store/auth'
import { useEstoqueStore } from '../../store/estoque'
import { useInventarioStore } from '../../store/inventario'
import { useManutencoesStore } from '../../store/manutencao'
import { useSolicitacoesStore } from '../../store/solicitacoes'
import { useUiStore } from '../../store/ui'
import type { Usuario } from '../../types'

export function ConfiguracoesPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const tema = useUiStore((s) => s.tema)
  const alternarTema = useUiStore((s) => s.alternarTema)
  const notificar = useUiStore((s) => s.notificar)

  const [backupPendente, setBackupPendente] = useState<{
    backup: Backup
    resumo: { nome: string; qtd: number }[]
  } | null>(null)
  const [confirmandoReset, setConfirmandoReset] = useState(false)

  let bytes = 0
  let chaves = 0
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i)
    if (!chave?.startsWith('ITSTOCK_')) continue
    chaves++
    bytes += chave.length + (localStorage.getItem(chave)?.length ?? 0)
  }
  const colecoes = COLECOES_BACKUP.map((nome) => ({
    nome,
    qtd: lerColecao(nome).length,
  }))
  const stats = {
    bytes,
    chaves,
    colecoes,
    totalRegistros: colecoes.reduce((soma, c) => soma + c.qtd, 0),
  }

  function exportar() {
    const backup = gerarBackup()
    baixarBackup(backup)
    registrarLog({
      usuario: usuario?.email ?? 'desconhecido',
      acao: 'EXPORT',
      tabela: 'BACKUP',
      registroId: backup.geradoEm.slice(0, 10),
      mensagem: `Backup exportado (${COLECOES_BACKUP.length} coleções)`,
    })
    notificar('sucesso', 'Backup exportado com sucesso')
  }

  function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    if (arquivo.size > 10 * 1024 * 1024) {
      notificar('erro', 'Arquivo muito grande (máximo 10 MB)')
      return
    }
    arquivo
      .text()
      .then((texto) => {
        const r = validarBackup(texto)
        if (!r.ok) {
          notificar('erro', r.erro)
          return
        }
        setBackupPendente({ backup: r.backup, resumo: r.resumo })
      })
      .catch(() => notificar('erro', 'Não foi possível ler o arquivo'))
  }

  function aplicar() {
    if (!backupPendente) return
    aplicarBackup(backupPendente.backup)
    useAtivosStore.getState().recarregar()
    useEstoqueStore.getState().recarregar()
    useSolicitacoesStore.getState().recarregar()
    useManutencoesStore.getState().recarregar()
    useInventarioStore.getState().recarregar()

    const sessaoRaw = localStorage.getItem('ITSTOCK_SESSAO')
    if (sessaoRaw) {
      try {
        const email = (JSON.parse(sessaoRaw) as Usuario).email
        const u = lerColecao<Usuario>('USUARIOS').find(
          (x) => x.email === email && x.status === 'Ativo',
        )
        if (u) useAuthStore.getState().atualizarSessao(u)
        else useAuthStore.getState().sair()
      } catch {
        useAuthStore.getState().sair()
      }
    }

    const total = backupPendente.resumo.reduce((s, c) => s + c.qtd, 0)
    registrarLog({
      usuario: usuario?.email ?? 'desconhecido',
      acao: 'IMPORT',
      tabela: 'BACKUP',
      registroId: backupPendente.backup.geradoEm.slice(0, 10),
      mensagem: `Backup restaurado (${total} registros)`,
    })
    setBackupPendente(null)
    notificar('sucesso', 'Backup restaurado com sucesso')
  }

  function restaurar() {
    const sessaoRaw = localStorage.getItem('ITSTOCK_SESSAO')
    restaurarDemo()
    let quem = 'sistema'
    if (sessaoRaw) {
      try {
        const email = (JSON.parse(sessaoRaw) as Usuario).email
        const u = lerColecao<Usuario>('USUARIOS').find(
          (x) => x.email === email && x.status === 'Ativo',
        )
        if (u) {
          localStorage.setItem('ITSTOCK_SESSAO', JSON.stringify(u))
          quem = u.email
        }
      } catch {
        // sessão inválida: segue deslogado
      }
    }
    registrarLog({
      usuario: quem,
      acao: 'RESET',
      tabela: 'SISTEMA',
      registroId: 'demo',
      mensagem: 'Dados restaurados para o estado inicial',
    })
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      <TituloSecao>Configurações</TituloSecao>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            {tema === 'claro' ? (
              <Sun size={16} className="text-primary" />
            ) : (
              <Moon size={16} className="text-primary" />
            )}
            <h3 className="text-sm font-semibold text-content">Aparência</h3>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-content">Tema atual</p>
              <p className="text-xs text-content-muted">
                {tema === 'claro' ? 'Claro' : 'Escuro (preto piano)'} —
                preferência salva neste navegador.
              </p>
            </div>
            <Botao variante="secundario" onClick={alternarTema}>
              Alternar tema
            </Botao>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Database size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-content">Armazenamento</h3>
          </div>
          <p className="text-sm text-content">
            {(stats.bytes / 1024).toFixed(1)} KB em {stats.chaves} chave(s) ·{' '}
            {stats.totalRegistros} registro(s)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.colecoes.map((c) => (
              <Badge key={c.nome} tom="neutral">
                {c.nome}: {c.qtd}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-content-muted">
            {modoSupabase
              ? 'Dados sincronizados com o banco do Supabase (o navegador guarda uma cópia local de leitura).'
              : 'Dados salvos apenas neste navegador (localStorage).'}
          </p>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Download size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-content">Backup e restauração</h3>
        </div>
        <p className="mb-4 text-xs text-content-muted">
          Exporte um arquivo JSON com todas as coleções (usuários, ativos,
          estoque, solicitações, manutenções, contagens e logs) ou restaure um
          backup anterior.
        </p>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={exportar}>
            <Download size={16} /> Exportar backup
          </Botao>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-content transition-all hover:bg-surface-3 hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-primary/30">
            <Upload size={16} />
            Importar backup
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={aoEscolherArquivo}
            />
          </label>
          <Botao
            variante="perigo"
            disabled={modoSupabase}
            title={
              modoSupabase
                ? 'Desativado: com o banco conectado os dados de demonstração não se aplicam'
                : undefined
            }
            onClick={() => setConfirmandoReset(true)}
          >
            <RotateCcw size={16} /> Restaurar dados demo
          </Botao>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-content">Sobre o sistema</h3>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-content-muted">Sistema</dt>
            <dd className="text-content">IT Stock &amp; Inventory — v1.0.0</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Stack</dt>
            <dd className="text-content">
              React 19 · TypeScript · Vite · Tailwind 4 · Zustand
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Repositório</dt>
            <dd className="text-content">github.com/wafeitoza/Sistema-de-T.I</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-content-muted">Dados</dt>
            <dd className="text-content">
              Armazenados localmente — sem servidor, sem senhas reais
            </dd>
          </div>
        </dl>
      </Card>

      <Modal
        aberto={!!backupPendente}
        aoFechar={() => setBackupPendente(null)}
        titulo="Restaurar backup"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setBackupPendente(null)}>
              Cancelar
            </Botao>
            <Botao onClick={aplicar}>Restaurar</Botao>
          </>
        }
      >
        <p className="mb-3 text-sm text-content">
          Backup gerado em{' '}
          <strong>
            {backupPendente
              ? new Date(backupPendente.backup.geradoEm).toLocaleString('pt-BR')
              : ''}
          </strong>
          . Os dados atuais serão substituídos pelos do arquivo:
        </p>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {backupPendente?.resumo.map((c) => (
            <li
              key={c.nome}
              className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs"
            >
              <span className="text-content-muted">{c.nome}</span>
              <span className="font-semibold text-content">{c.qtd}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        aberto={confirmandoReset}
        aoFechar={() => setConfirmandoReset(false)}
        titulo="Restaurar dados de demonstração"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmandoReset(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              onClick={() => {
                setConfirmandoReset(false)
                restaurar()
              }}
            >
              Restaurar tudo
            </Botao>
          </>
        }
      >
        <p className="text-sm text-content">
          Todos os dados (ativos, estoque, solicitações, manutenções, contagens,
          usuários e logs) serão apagados e o estado de demonstração será
          recriado. O tema volta ao padrão. <strong>Esta ação não pode ser
          desfeita</strong> — exporte um backup antes se quiser preservar.
        </p>
      </Modal>
    </div>
  )
}
