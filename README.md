# IT Stock & Inventory — React

Sistema de gestão de T.I. (ativos, estoque, inventário, solicitações e manutenção) em React, baseado na especificação `IT-Stock-Specs/SISTEMA-IT-STOCK.md`.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 4 (tema claro/escuro)
- React Router 7 · Zustand · Recharts · lucide-react
- Persistência: `localStorage` (camada de repositório em `src/data/repository.ts`, trocável por API real)

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build -> dist/
npm run lint     # oxlint
```

## Perfis demo (login sem senha)

| Perfil | E-mail | Acesso |
|---|---|---|
| Admin | admin@empresa.com | tudo |
| Gerente | gerente@empresa.com | solicitações + aprovação |
| Técnico | tecnico@empresa.com | ativos, estoque, manutenção |
| Visualizador | viewer@empresa.com | somente leitura |

## Deploy na Vercel

- Framework: **Vite** (auto-detectado) · Build: `npm run build` · Output: `dist`
- `vercel.json` inclui rewrite SPA — necessário para rotas profundas como `/aprovacao/:token`

```bash
# via CLI
npm i -g vercel && vercel
```

## Estrutura

```
src/
├── types/        modelos de dados (Ativo, Estoque, Solicitação, Manutenção…)
├── data/         seed demo + repositório localStorage
├── lib/          regras: RN001 códigos, validação, permissões, auditoria, tokens HMAC
├── store/        Zustand: auth, ativos, estoque, solicitacoes, manutencao, inventario, ui
├── components/   layout (sidebar/header) + kit de UI
└── pages/        login, dashboard, ativos, estoque, inventário, solicitacoes, manutencao
```

## Regras de negócio implementadas (MVP)

- **RN001** código único de ativo (`NOTE-001`, `MON-001`…)
- **RN002** máquina de status do ativo (descarte = irreversível)
- **RN003** alerta de baixo estoque (badge + dashboard)
- **RN004** aprovação por link assinado (`/aprovacao/:token`, expira em 7 dias)
- **RN007** manutenção: próxima preventiva = conclusão + 90 dias, alerta ≤ 5 dias
- **RN009** auditoria: log + diff de cada operação
- **RN010** inventário: contagem física de estoque com divergências e
  ajuste automático de saldo (entradas/saídas tipo `Ajuste` + auditoria)
- Relatório de ativos exportável em CSV (filtros, responsável e data no cabeçalho)
- Perfis de acesso: Admin, Gerente, Técnico, Visualizador
