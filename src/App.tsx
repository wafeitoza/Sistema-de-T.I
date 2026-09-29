import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Toasts } from './components/ui/Toasts'
import { AprovacaoPage } from './pages/solicitacoes/AprovacaoPage'
import { AtivosPage } from './pages/ativos/AtivosPage'
import { DashboardPage } from './pages/DashboardPage'
import { EstoquePage } from './pages/estoque/EstoquePage'
import { LoginPage } from './pages/LoginPage'
import { ManutencaoPage } from './pages/manutencao/ManutencaoPage'
import { SolicitacoesPage } from './pages/solicitacoes/SolicitacoesPage'

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
          <Route path="/solicitacoes" element={<SolicitacoesPage />} />
          <Route path="/manutencao" element={<ManutencaoPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </BrowserRouter>
  )
}
