import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Toasts } from './components/ui/Toasts'
import { AprovacaoPage } from './pages/solicitacoes/AprovacaoPage'
import { AtivosPage } from './pages/ativos/AtivosPage'
import { AuditoriaPage } from './pages/auditoria/AuditoriaPage'
import { ConfiguracoesPage } from './pages/config/ConfiguracoesPage'
import { DashboardPage } from './pages/DashboardPage'
import { EstoquePage } from './pages/estoque/EstoquePage'
import { InventarioPage } from './pages/inventario/InventarioPage'
import { LoginPage } from './pages/LoginPage'
import { ManutencaoPage } from './pages/manutencao/ManutencaoPage'
import { SolicitacoesPage } from './pages/solicitacoes/SolicitacoesPage'
import { UsuariosPage } from './pages/usuarios/UsuariosPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/aprovacao/:token" element={<AprovacaoPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ativos" element={<AtivosPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/inventario" element={<InventarioPage />} />
          <Route path="/solicitacoes" element={<SolicitacoesPage />} />
          <Route path="/manutencao" element={<ManutencaoPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/auditoria" element={<AuditoriaPage />} />
          <Route path="/config" element={<ConfiguracoesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </BrowserRouter>
  )
}
