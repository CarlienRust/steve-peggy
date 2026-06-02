# Peggy UI — Lovable reference (MUI implementation)

**Mockup:** [source-sense-lab.lovable.app](https://source-sense-lab.lovable.app)

Implemented with **Material UI only** (no Tailwind). Design tokens in `theme/peggyTheme.ts`.

| Lovable | Peggy (MUI) |
|---------|-------------|
| Sidebar shell | `components/AppShell.tsx` |
| Dashboard | `components/DashboardPage.tsx` |
| Page headers | `components/PageHeader.tsx` |
| Fonts | Inter + JetBrains Mono via `next/font` |

Set workspace title/focus in `apps/web/.env.local`:
- `NEXT_PUBLIC_WORKSPACE_TITLE`
- `NEXT_PUBLIC_WORKSPACE_FOCUS`
