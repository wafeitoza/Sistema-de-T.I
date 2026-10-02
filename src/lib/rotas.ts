import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  Truck,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SecaoNav = 'Operação' | 'Cadastros' | 'Sistema'

export interface RotaNav {
  para: string
  rotulo: string
  icone: LucideIcon
  secao: SecaoNav
}

export const ROTAS_NAVEGACAO: RotaNav[] = [
  { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard, secao: 'Operação' },
  { para: '/ativos', rotulo: 'Ativos', icone: Boxes, secao: 'Operação' },
  { para: '/estoque', rotulo: 'Estoque', icone: Package, secao: 'Operação' },
  { para: '/inventario', rotulo: 'Inventário', icone: ClipboardCheck, secao: 'Operação' },
  { para: '/movimentacoes', rotulo: 'Movimentações', icone: ArrowLeftRight, secao: 'Operação' },
  { para: '/solicitacoes', rotulo: 'Solicitações', icone: ClipboardList, secao: 'Operação' },
  { para: '/manutencao', rotulo: 'Manutenção', icone: Wrench, secao: 'Operação' },
  { para: '/setores', rotulo: 'Setores', icone: Building2, secao: 'Cadastros' },
  { para: '/fornecedores', rotulo: 'Fornecedores', icone: Truck, secao: 'Cadastros' },
  { para: '/termos', rotulo: 'Termos', icone: FileSignature, secao: 'Cadastros' },
  { para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3, secao: 'Sistema' },
  { para: '/usuarios', rotulo: 'Usuários', icone: Users, secao: 'Sistema' },
  { para: '/auditoria', rotulo: 'Auditoria', icone: ScrollText, secao: 'Sistema' },
  { para: '/config', rotulo: 'Configurações', icone: Settings, secao: 'Sistema' },
]
