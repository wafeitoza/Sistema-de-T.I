import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Toasts } from './components/ui/Toasts'
import { AprovacaoPage } from './pages/solicitacoes/AprovacaoPage'
import { AtivosPage } from './pages/ativos/AtivosPage'
import { AuditoriaPage } from './pages/auditoria/AuditoriaPage'
import { ConfiguracoesPage } from './pages/config/ConfiguracoesPage'
import { DashboardPage } from './pages/DashboardPage'
import { RelatoriosPage } from './pages/relatorios/RelatoriosPage'
import { EstoquePage } from './pages/estoque/EstoquePage'
import { EmprestimosPage } from './pages/emprestimos/EmprestimosPage'
import { InventarioPage } from './pages/inventario/InventarioPage'
import { LoginPage } from './pages/LoginPage'
import { ManutencaoPage } from './pages/manutencao/ManutencaoPage'
import { MovimentacoesPage } from './pages/movimentacoes/MovimentacoesPage'
import { FornecedoresPage } from './pages/fornecedores/FornecedoresPage'
import { SetoresPage } from './pages/setores/SetoresPage'
import { SolicitacoesPage } from './pages/solicitacoes/SolicitacoesPage'
import { TermosPage } from './pages/termos/TermosPage'
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
          <Route path="/movimentacoes" element={<MovimentacoesPage />} />
          <Route path="/emprestimos" element={<EmprestimosPage />} />
          <Route path="/setores" element={<SetoresPage />} />
          <Route path="/fornecedores" element={<FornecedoresPage />} />
          <Route path="/termos" element={<TermosPage />} />
          <Route path="/manutencao" element={<ManutencaoPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/auditoria" element={<AuditoriaPage />} />
          <Route path="/config" element={<ConfiguracoesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </BrowserRouter>
  )
}
