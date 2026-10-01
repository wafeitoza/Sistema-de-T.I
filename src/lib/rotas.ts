import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface RotaNav {
  para: string
  rotulo: string
  icone: LucideIcon
}

export const ROTAS_NAVEGACAO: RotaNav[] = [
  { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard },
  { para: '/ativos', rotulo: 'Ativos', icone: Boxes },
  { para: '/estoque', rotulo: 'Estoque', icone: Package },
  { para: '/inventario', rotulo: 'Inventário', icone: ClipboardCheck },
  { para: '/solicitacoes', rotulo: 'Solicitações', icone: ClipboardList },
  { para: '/manutencao', rotulo: 'Manutenção', icone: Wrench },
  { para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3 },
  { para: '/usuarios', rotulo: 'Usuários', icone: Users },
  { para: '/auditoria', rotulo: 'Auditoria', icone: ScrollText },
  { para: '/config', rotulo: 'Configurações', icone: Settings },
]
