import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { iniciar } from './data/bootstrap'
import { modoSupabase } from './data/client'
import { iniciarErros } from './data/erros'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { useAuthStore } from './store/auth'
import './index.css'

const raiz = createRoot(document.getElementById('root')!)

// No modo Supabase o App só monta depois das tabelas baixarem — senão os
// stores inicializariam com o espelho vazio.
if (modoSupabase) {
  raiz.render(
    <div className="grid min-h-screen place-items-center text-sm text-content-muted">
      Carregando dados…
    </div>,
  )
}

// O Sentry precisa estar pronto antes do boot, senão um erro ali no início
// escaparia. Sem `VITE_SENTRY_DSN` `iniciarErros()` resolve na hora e não
// baixa chunk nenhum.
void iniciarErros()
  .then(() => iniciar())
  .catch((erro) => console.error('bootstrap:', erro))
  .finally(async () => {
    // Restaura a sessão Supabase (e-mail+senha) antes do Layout redirecionar
    // para o login. No modo local a sessão já vem do localStorage.
    if (modoSupabase) {
      try {
        await useAuthStore.getState().restaurarSessao()
      } catch (erro) {
        console.error('sessão:', erro)
      }
    }
    const { default: App } = await import('./App.tsx')
    raiz.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  })
