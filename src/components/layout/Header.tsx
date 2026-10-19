import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Maximize2, Menu, Minimize2, Moon, Search, Sun } from 'lucide-react'
import { saudacao } from '../../lib/format'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import { PrevisaoTempo } from './PrevisaoTempo'
import { Relogio } from './Relogio'
import { SinoNotificacoes } from './SinoNotificacoes'

const TITULOS: Record<string, string> = {
  '/': 'Dashboard',
  '/ativos': 'Ativos',
  '/estoque': 'Estoque',
  '/inventario': 'Inventário',
  '/solicitacoes': 'Solicitações',
  '/movimentacoes': 'Movimentações',
  '/setores': 'Setores',
  '/fornecedores': 'Fornecedores',
  '/termos': 'Termos',
  '/manutencao': 'Manutenção',
  '/relatorios': 'Relatórios',
  '/usuarios': 'Usuários',
  '/auditoria': 'Auditoria',
  '/config': 'Configurações',
}

export function Header() {
  const { pathname } = useLocation()
  const usuario = useAuthStore((s) => s.usuario)
  const tema = useUiStore((s) => s.tema)
  const alternarTema = useUiStore((s) => s.alternarTema)
  const alternarSidebar = useUiStore((s) => s.alternarSidebar)
  const alternarBusca = useUiStore((s) => s.alternarBusca)
  const telaCheia = useUiStore((s) => s.telaCheia)
  const alternarTelaCheia = useUiStore((s) => s.alternarTelaCheia)
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Tela cheia do navegador junto com o modo da interface. Se o navegador
  // negar (iframe, permissão), a interface mesmo assim fica em modo tela
  // cheia — só o chrome do navegador continua visível.
  const aoAlternarTelaCheia = () => {
    const ativando = !telaCheia
    alternarTelaCheia()
    try {
      if (ativando) {
        void document.documentElement.requestFullscreen?.()?.catch(() => {})
      } else if (document.fullscreenElement) {
        void document.exitFullscreen?.()?.catch(() => {})
      }
    } catch {
      /* modo interface já foi aplicado; sem tela cheia do navegador */
    }
  }

  // ESC (ou qualquer outra saída da tela cheia do navegador) desliga o
  // modo da interface também, para os dois nunca ficarem fora de sincronia.
  useEffect(() => {
    const aoSairDoNavegador = () => {
      if (!document.fullscreenElement && telaCheia) alternarTelaCheia()
    }
    document.addEventListener('fullscreenchange', aoSairDoNavegador)
    return () => document.removeEventListener('fullscreenchange', aoSairDoNavegador)
  }, [telaCheia, alternarTelaCheia])

  const primeiroNome = usuario?.nome.split(' ')[0] ?? ''

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={alternarSidebar}
          className="rounded-lg p-2 text-content-muted hover:bg-surface-2 hover:text-content md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <p
            key={pathname}
            className="anim-fade-up truncate text-sm font-bold tracking-tight text-content"
          >
            {saudacao(agora)}, <span className="gradient-text">{primeiroNome}</span>
          </p>
          <p className="hidden truncate text-[11px] text-content-muted sm:block">
            {TITULOS[pathname] ?? 'IT Stock'} · Sistema de gestão de T.I.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <PrevisaoTempo />
        <Relogio />
        <button
          onClick={alternarBusca}
          className="hidden items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-content-muted transition-colors hover:text-content sm:flex"
          aria-label="Abrir busca global"
        >
          <Search size={14} />
          <span>Buscar</span>
          <kbd className="rounded border border-line bg-surface px-1 py-0.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>
        <SinoNotificacoes />
        <button
          onClick={aoAlternarTelaCheia}
          className="rounded-lg p-2 text-content-muted transition-all duration-200 hover:bg-surface-2 hover:text-content hover:shadow-md active:scale-90"
          aria-label={telaCheia ? 'Sair da tela cheia' : 'Ativar tela cheia'}
          title={telaCheia ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
        >
          {telaCheia ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <button
          onClick={alternarTema}
          className="rounded-lg p-2 text-content-muted transition-all duration-200 hover:rotate-12 hover:bg-surface-2 hover:text-content hover:shadow-md active:scale-90"
          aria-label="Alternar tema"
        >
          {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  )
}
