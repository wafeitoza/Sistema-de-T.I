import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { modoSupabase } from '../../data/client'
import { podeAcessarRota } from '../../lib/permissions'
import { Botao } from '../ui/Botao'
import { Modal } from '../ui/Modal'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import { BuscaGlobal } from './BuscaGlobal'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function Layout() {
  const usuario = useAuthStore((s) => s.usuario)
  const trocarSenhaPendente = useAuthStore((s) => s.trocarSenhaPendente)
  const { pathname } = useLocation()

  if (!usuario) return <Navigate to="/login" replace />

  const permitido = podeAcessarRota(pathname, usuario.perfil)

  return (
    <div className="flex min-h-screen bg-surface-2">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6">
          <div key={pathname} className="anim-pagina">
            {permitido ? (
              <OutletContent />
            ) : (
              <AcessoNegado perfil={usuario.perfil} />
            )}
          </div>
        </main>
      </div>
      <BuscaGlobal />
      {modoSupabase && trocarSenhaPendente && <TrocaSenhaObrigatoria />}
    </div>
  )
}

/**
 * Senha provisória: bloqueia o uso do sistema até o usuário definir a sua.
 * Só existe no modo Supabase (quem entra por card não passa por aqui).
 */
function TrocaSenhaObrigatoria() {
  const trocarSenha = useAuthStore((s) => s.trocarSenha)
  const notificar = useUiStore((s) => s.notificar)
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setErro('')
    if (nova.length < 8) {
      setErro('A nova senha precisa ter pelo menos 8 caracteres')
      return
    }
    if (nova !== confirma) {
      setErro('As duas senhas não são iguais')
      return
    }
    setEnviando(true)
    const r = await trocarSenha(nova)
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível alterar a senha')
      return
    }
    setNova('')
    setConfirma('')
    notificar('sucesso', 'Senha alterada. Bom trabalho!')
  }

  return (
    <Modal
      aberto
      aoFechar={() => undefined}
      titulo="Defina a sua senha"
      rodape={
        <Botao onClick={confirmar} disabled={enviando}>
          <KeyRound size={16} /> Salvar nova senha
        </Botao>
      }
    >
      <p className="mb-4 text-sm text-content">
        Você entrou com a <strong>senha provisória</strong>. Escolha uma senha
        própria para continuar usando o sistema.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-content-muted">
            Nova senha
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="mínimo de 8 caracteres"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-content placeholder:text-content-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-content-muted">
            Confirmar nova senha
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            placeholder="repita a senha"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-content placeholder:text-content-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {erro && (
          <p
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
          >
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

function OutletContent() {
  return <Outlet />
}

function AcessoNegado({ perfil }: { perfil: string }) {
  return (
    <div className="anim-bounce-in mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
      <div className="anim-pulse-ring flex h-12 w-12 items-center justify-center rounded-full bg-danger/15">
        <ShieldAlert size={22} className="text-danger" />
      </div>
      <h2 className="text-base font-semibold text-content">Acesso restrito</h2>
      <p className="text-sm text-content-muted">
        O perfil <strong>{perfil}</strong> não tem permissão para acessar este módulo.
      </p>
    </div>
  )
}
