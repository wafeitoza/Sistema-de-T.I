import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { reportarErro } from '../../data/erros'
import { Botao } from './Botao'

interface Estado {
  erro: Error | null
}

/**
 * Evita a tela branca: um erro de render hoje derrubava a árvore inteira e
 * nem o console mostrava de onde veio. Aqui a falha vira uma tela com
 * "Recarregar", o erro vai para o console **e** para o Sentry (quando houver
 * DSN configurada) junto com a pilha de componentes.
 *
 * Fica em volta do `<App/>` em `main.tsx`, por fora do `StrictMode` — ele só
 * captura o que escapar dos handlers individuais.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null }

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error('render:', erro, info.componentStack)
    reportarErro(erro, {
      componentStack: info.componentStack ?? undefined,
      pagina: typeof window !== 'undefined' ? window.location.pathname : undefined,
    })
  }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children

    return (
      <div className="grid min-h-screen place-items-center bg-surface-2 px-4">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-card">
          <div className="anim-float mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-danger/15 to-primary/15">
            <AlertTriangle size={22} className="text-danger" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-content">
            A tela encontrou um erro
          </h1>
          <p className="mt-2 text-sm text-content-muted">
            O sistema parou de responder nesta página. Recarregue — se o
            problema voltar a acontecer, informe o administrador com a data e a
            hora.
          </p>
          <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left font-mono text-[11px] break-words text-content-muted">
            {erro.message || 'Erro sem descrição'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Botao onClick={() => window.location.reload()}>Recarregar</Botao>
          </div>
        </div>
      </div>
    )
  }
}
