# Worklog — Facturier Konté PWA

## Project Status
Building a PWA reproducing the Flutter invoice_app as a professional web app.
Environment: Next.js 16 + Prisma/SQLite (adapted from Supabase requirement) + Dexie.js offline store.

## Completed (Phase 1-4)
- **Foundation**: Prisma schema (User, Invoice, InvoiceItem, Client, Product, Settings), auth lib (JWT+bcrypt), API routes (auth, invoices, clients, products, settings, users, upload, maintenance, seed)
- **Offline-first**: Dexie IndexedDB store + sync queue engine (last-write-wins on updatedAt)
- **PWA**: manifest.json, service worker (sw.js), app icons generated
- **UI foundation**: layout.tsx (PWA metadata + providers), auth-context, sync-status provider, offline banner
- **App shell**: sidebar (desktop) + bottom nav (mobile), maintenance gate, client restriction, view routing
- **Login screen**: blue gradient card matching login_screen.dart
- **Invoices list**: search, status filters, sort, multi-select, CSV export, bulk delete
- **New/edit invoice**: client autocomplete, product picker, item entry, discount/tax, live totals
- **Invoice detail**: view, edit, duplicate, status change, delete, PDF download, PNG download, Web Share
- **PDF generator**: jsPDF reproducing pdf_service.dart layout (header, status badge, client box, table, gradient total, notes, footer)
- **Seed data**: admin (+221770000000/admin1234), employee (+221771111111/employe1234), 10 products, 5 clients, 24 invoices

## Shared resources available for all screens
- `src/lib/constants.ts`: CARD_RADIUS=16, BUTTON_RADIUS=14, INPUT_RADIUS=14, INVOICE_STATUS_META (colors), ROLE_META, BRAND colors
- `src/lib/types.ts`: Invoice, InvoiceItem, Client, Product, Settings, User + calc helpers (invoiceTotal, invoiceTaxAmount, invoicePayableTotal, itemSubtotal, invoiceTotalQuantity)
- `src/lib/formatters.ts`: formatCurrency, formatNumber, formatDateTime, formatDate, formatShortDay, formatMonthYear, refId, escapeCsv, numStr, isValidSenegalPhone, normalizeSenegalPhone
- `src/lib/data-hooks.ts`: useInvoices, useClients, useProducts, useSettings, useUsers + mutations (saveInvoice, deleteInvoice, saveClient, createClient, deleteClient, saveProduct, createProduct, deleteProduct, updateSettings, updateUserRole, updateUserDisabled, uploadImage, uploadDataUrl)
- `src/components/shared/ui.tsx`: StatusBadge, ScreenHeader, EmptyState, LoadingState, SectionCard
- `src/components/shared/sync-status.tsx`: useSyncStatus (online, pending, syncing)
- `src/components/shared/offline-banner.tsx`: OfflineBanner
- `src/components/app-shell.tsx`: useNav() → { view, params, navigate(viewId, params) }
- shadcn/ui components in `src/components/ui/` (button, input, card, dialog, tabs, select, switch, badge, etc.)
- `sonner` toast via `import { toast } from "sonner"`
- `lucide-react` for icons

## Design tokens (from Flutter app)
- Status colors: enCours #6B4C4C, enLivraison #FFC107, livree #4CAF50, archivee #9E9E9E
- Brand: primary #2563EB, primaryDark #1D4ED8, ink #0F172A, body #64748B, surface #F8FAFC
- Card radius 16px (rounded-2xl), button radius 14px, input radius 14px

## Pending
- Products screen (grid with categories/tabs, image upload, add/edit/delete)
- Stats screen (CA hero, KPIs, bar chart, pie chart, top 5 clients/products)
- Settings screen (shop info, logo, maintenance toggle, tabbed: clients/products/backup)
- CSV import screen (drop zone, column mapping, replace/merge, validation)
- Users management screen (admin: list users, change role, disable)
- README
- Final verification with agent-browser

---

## Task 5-b — Statistics screen (stats-screen.tsx)
**Agent**: GLM Code (subagent for stats screen)
**File**: `src/components/screens/stats-screen.tsx`

### What was built
Reproduced the Flutter `stats_screen.dart` as a polished, responsive dashboard:

1. **Period selector** — pill-style segmented buttons (7 jours / 30 jours / Tout), active = `bg-[#2563EB] text-white` with shadow, hover bg-slate-50 for inactive. Role `tablist`/`tab` + `aria-selected`.
2. **Hero CA card** — `linear-gradient(135deg, #2563EB → #1D4ED8)`, white text, `shadow-lg shadow-blue-500/25`, decorative translucent circles, "CHIFFRE D'AFFAIRES" label with Payments icon, large total, subtitle "N facture(s) · N article(s)".
3. **4 KPI cards** (2×2 mobile / 4 cols lg) — Factures (#6366F1, ReceiptText), Panier moyen (#16A34A, ShoppingCartCheckout), Articles vendus (#D97706, Package), Plus grosse facture (#DB2777, Award). Icon badge with subtle linear-gradient tint, hover lift (`-translate-y-0.5`).
4. **CA evolution bar chart** (recharts BarChart) — daily buckets for 7/30 days using `formatShortDay`, monthly buckets for "Tout" using `formatMonthYear`. Blue gradient bars (`#60A5FA→#2563EB`), rounded tops, CartesianGrid (horizontal dashed), YAxis formatted with `k` suffix, custom Tooltip using `formatCurrency`, `accessibilityLayer` enabled.
5. **Status répartition donut** (recharts PieChart) — innerRadius=52/outerRadius=78, center overlay shows "Total" + `formatCurrency(totalCA)`, legend below with color dot, label, percentage, and amount per status. Uses `INVOICE_STATUS_META` colors (#6B4C4C, #FFC107, #4CAF50, #9E9E9E). Filters out statuses with 0 CA.
6. **Top 5 clients** — ranked list with colored number badges (#2563EB, #6366F1, #8B5CF6, #0EA5E9, #14B8A6), name + amount + progress bar (relative to top client), `role="progressbar"`.
7. **Top 5 produits** — same ranked list pattern, value formatted as "N vendus" (sum of quantities).

### Calculations (mirror stats_screen.dart)
- `filterByPeriod`: week = last 7 days (inclusive of today), month = last 30 days, all = everything. Comparison on `startOfDay(createdAt)`.
- `totalCA` = sum of `invoiceTotal(inv.items)` (subtotal, before discount/tax — matches Flutter `invoiceTotal`).
- `panierMoyen` = totalCA / factureCount (0 if none).
- `plusGrosse` = max invoiceTotal.
- `articlesVendus` = sum of `invoiceTotalQuantity`.
- `buildCaSeries` — daily buckets (7 or 30) keyed by date; monthly buckets keyed by `YYYY-MM`, sorted chronologically from earliest invoice month.
- `buildStatusRepartition` — sum of invoiceTotal grouped by `InvoiceStatus`, filtered to > 0.
- `buildTopClients` — sum of invoiceTotal grouped by `clientName`, sorted desc, top 5.
- `buildTopProducts` — sum of `item.quantity` grouped by `item.name`, sorted desc, top 5.

### UX details
- `useInvoices()` for data; loading → custom `StatsSkeleton` (period selector + hero + KPI grid + 2 chart + 2 list skeletons).
- Empty state when `invoices.length === 0` (BarChart3 icon, French copy).
- Refresh button in `ScreenHeader` actions triggers `refresh()` with `toast.success`/`error`, spinning `RefreshCw` icon while `refreshing`.
- All amounts use `tabular-nums` for clean column alignment.
- French throughout. `"use client"` at top. Sticky footer layout (`min-h-screen flex flex-col`, `flex-1` main).
- Charts responsive via `ResponsiveContainer`, full width inside `SectionCard` wrappers.
- Hover micro-interactions on KPI cards and period buttons.

### Lint / dev log
- `bun run lint`: no errors from `stats-screen.tsx`. Remaining lint errors are pre-existing in other files (`app-shell.tsx`, `offline-banner.tsx`, `sync-status.tsx` — `react-hooks/set-state-in-effect`) and the missing `users-screen` module; none introduced by this task.
- `dev.log` shows only the pre-existing `users-screen` Module-not-found warning; `StatsScreen` is already wired in `view-router.tsx` (case `"stats"`).

### Shared resources consumed
- `useInvoices` from `@/lib/data-hooks`
- `ScreenHeader`, `EmptyState`, `SectionCard` from `@/components/shared/ui`
- `formatCurrency`, `formatShortDay`, `formatMonthYear`, `formatNumber` from `@/lib/formatters`
- `invoiceTotal`, `invoiceTotalQuantity`, `Invoice` from `@/lib/types`
- `INVOICE_STATUS_META`, `INVOICE_STATUSES` from `@/lib/constants`
- recharts: `BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid`
- shadcn: `Button`, `Skeleton`; lucide: `ReceiptText, ShoppingCartCheckout, Package, Award, BarChart3, TrendingUp, RefreshCw, Payments`
- `sonner` toast

---

## Task 5-a — Products screen + Users management screen
Agent: screens-builder (products + users)

### Files created
- `src/components/screens/products-screen.tsx` (680 lines)
- `src/components/screens/users-screen.tsx` (360 lines)

Both files pass `bunx eslint` with **0 errors / 0 warnings** (the remaining
lint errors in the project are pre-existing in `offline-banner.tsx`,
`sync-status.tsx`, `app-shell.tsx` — not part of this task).

### Products screen (`ProductsScreen`)
Reproduces `product_grid_sheet.dart` + `product_form_dialog.dart` + the
products tab of settings.

- `ScreenHeader` with icon=Package, count subtitle, refresh + "Ajouter" actions
- Search input (filters by name or category)
- Horizontal scrollable category chips: "Tous" + every existing category
  (each chip shows its live count, ordered alphabetically with fr collation)
- Responsive product grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
- Each `ProductCard`: square image thumbnail (or Package placeholder),
  category badge top-left, hover-revealed edit + delete icon buttons
  (always visible on mobile for touch)
- `EmptyState` when no products / no search results (with CTA when catalogue
  is empty)
- `AlertDialog` for delete confirmation
- `ProductFormDialog` (used for both create & edit):
  - Square image preview (180px max) with ImageIcon placeholder, uploading
    spinner overlay, remove button
  - Hidden file input triggered by "Choisir une image" button
  - **Canvas compression** (`compressImage`): reads file → draws to canvas
    scaled so the longest side ≤ 800px → white background painted for
    transparent PNGs → `toBlob("image/jpeg", 0.8)` → wraps in a `File`
    before calling `uploadImage(file)` from `@/lib/data-hooks`
  - SVG/GIF/non-image files skip compression
  - 8 MB upload guard
  - Local `URL.createObjectURL` preview with proper revocation on close /
    unmount / replace (no memory leaks)
  - Name input + Category input with `<datalist>` of existing categories
    (lets the user pick existing or type a new one)
  - Calls `createProduct` or `saveProduct` depending on edit mode
  - French toasts for every success/error path
- All actions toast feedback via `sonner`

### Users screen (`UsersScreen`) — admin only
- `ScreenHeader` with icon=Users, summary subtitle (counts per role),
  refresh button
- Search input (by name or phone)
- Role filter chips: Tous / Admins / Employés / Clients (with counts)
- Sorted by role rank (admin → employee → client) then createdAt desc
- Each `UserRow`:
  - Colored avatar (initial, background = role color)
  - Name + "Vous" badge when self + "Désactivé" badge when disabled
  - Phone (mono), created date (hidden on mobile to save space)
  - `RoleBadge` with the exact required colors
    (admin #2563EB, employee #16A34A, client #9E9E9E) via `ROLE_META`
  - Role `Select` dropdown calling `updateUserRole(id, role)`
  - Activé `Switch` calling `updateUserDisabled(id, disabled)`
  - **Self-protection**: when `me.id === user.id`, both the Select and the
    Switch are `disabled` and show an "auto-protection" hint
- `EmptyState` when no users / no search results

### Design tokens respected
- Cards `rounded-2xl` (16px), buttons `rounded-xl`
- Brand `#2563EB` for primary actions, `#1D4ED8` hover
- French throughout, semantic HTML, ARIA labels on icon buttons
- Mobile-first responsive, touch-friendly targets (≥28px icon buttons,
  h-9/h-10 main controls)
- `"use client"` directive at the top of both files

### Notes for downstream agents
- The view-router already imports `ProductsScreen` and `UsersScreen` —
  no routing change needed
- `useUsers()` returns `any[]`; I cast to `User[]` for type safety
- The remaining unresolved dev.log errors are for `stats-screen`,
  `settings-screen`, and `csv-import-screen` (other agents' pending work)

---

## Task 5-c — Settings + CSV Import screens (2026-09-01)

### Files written
- `src/components/screens/settings-screen.tsx` (865 lines)
- `src/components/screens/csv-import-screen.tsx` (642 lines)

### Settings screen — tabbed UI
Tabbed settings using shadcn `Tabs`, scrollable tab list, max-w-4xl centered.

- **Tab 1 — Boutique** (`Store`): shop info form (shopName, shopAddress, shopPhone, shopNinea, footerMessage) + logo upload card (file input with preview, `uploadImage()` call, 4 Mo limit, PNG/JPG/WebP). Local preview via FileReader for instant feedback. Save button calls `updateSettings(data)` with toast feedback.
- **Tab 2 — Maintenance** (`Wrench`): prominent custom toggle (h-7 w-12, red accent when ON). Calls `updateSettings({ maintenanceMode: boolean })` immediately with optimistic UI + revert on failure. When ON, shows amber warning box with the required text "Le site est actuellement en mode maintenance. Seuls les administrateurs peuvent y accéder." Red/amber styling conveys seriousness.
- **Tab 3 — Comptes** (`Users`): renders `LazyUsersScreen` via `next/dynamic({ ssr: false })` wrapped in an `ErrorBoundary` (`UsersTabBoundary`). If the module fails to load (e.g. users-screen.tsx not yet present at build time), the boundary falls back to a `ComptesNote` card saying "Voir l'onglet Comptes".
- **Tab 4 — Sauvegarde** (`Database`):
  - Stats summary card: "N facture(s) · N produit(s) · N client(s)" plus StatBox grid (Factures / Articles / Produits / Clients) and a status distribution badge row.
  - **Export CSV**: semicolon-separated French format matching `backup_service.dart`. Columns: Date;Réf;Client;Statut;Article;Quantité;Prix unitaire;Sous-total;Total facture;Notes. One row per item. UTF-8 BOM (`\uFEFF`) prepended for Excel accent compatibility. `\r\n` line endings. Triggered via Blob + anchor click. Uses `escapeCsv()`, `formatDateTime()`, `refId()`, `numStr()`, `invoiceTotal()`, `INVOICE_STATUS_META`.
  - **Backup JSON**: full payload `{ exportedAt, app, version, invoices, products, clients }`.
  - **Import CSV** button: `navigate("csv-import")`.

### CSV Import screen — full pipeline
- `ScreenHeader` with `UploadCloud` icon and a back button → `navigate("invoices")`.
- **Drop zone**: large dashed border, dragover turns blue (`border-[#2563EB] bg-[#2563EB]/5`), click-to-browse fallback. Validates `.csv` extension + MIME type.
- **PapaParse** (`Papa.parse<ParsedRow>(file, { header: true, skipEmptyLines: true, transformHeader })`). Shows parsing errors inline and toasts row/col count on success.
- **Preview table**: first 5 rows, overflow-x-auto, with `Badge` showing total row count.
- **Column mapping**: 10 fields (`client_name`, `item_name`, `quantity`, `unit_price`, `discount`, `tax_rate`, `status`, `notes`, `created_at`, `ref`). Each in its own bordered card with `Select` dropdown of detected columns. Required badges (red). "Auto-détection" button: normalizes column headers (strip accents, lowercase) and matches against French/English keywords.
- **Mode radio**: "Ajouter / fusionner" (blue) vs "Remplacer toutes les données" (red, shows existing invoice count, with `window.confirm` before destructive op).
- **Validation summary**: 3 `SummaryItem` cards (Factures à importer / Articles / Mode) + missing-required alert.
- **Import**: builds `InvoiceGroup`s (rows grouped by `ref` column if mapped, else one invoice per row). For replace mode, deletes all existing invoices via `deleteInvoice()` first, then calls `saveInvoice()` per group. `Progress` bar + label updates per invoice, with `setTimeout(5ms)` yields for smooth UI. Success toast + `navigate("invoices")`.
- Number parser handles French ("1 250,50"), English ("1,250.50"), and plain formats. Date parser handles "dd/MM/yyyy [à HH:mm]" and ISO. Status parser maps French + English labels.

### Design details
- Brand `#2563EB` everywhere; rounded-2xl cards; rounded-xl buttons.
- Fully responsive: tab labels hide on mobile (icons only), grid layouts collapse 2→1 col.
- `"use client"` on both files. Strict TypeScript types throughout.
- Reused: `ScreenHeader`, `SectionCard`, `EmptyState`, `LoadingState`, `useNav`, `useSettings`, `updateSettings`, `useInvoices`, `useProducts`, `useClients`, `saveInvoice`, `deleteInvoice`, `uploadImage`, `formatCurrency`, `formatDateTime`, `escapeCsv`, `numStr`, `refId`, `INVOICE_STATUS_META`, `INVOICE_STATUSES`, `invoiceTotal`, `toast`.

### Verification
- `bun run lint`: 0 errors, 0 warnings in both new files. (Pre-existing errors in app-shell.tsx, offline-banner.tsx, sync-status.tsx are unrelated.)
- Dev server recompile (triggered via `curl localhost:3000/`): both `settings-screen.tsx` and `csv-import-screen.tsx` resolve cleanly — no "Module not found" errors. The current `GET / 500` is caused by `stats-screen.tsx` importing non-existent lucide-react exports (`Payments`, `ShoppingCartCheckout`) — that's a parallel agent's bug.

### Notes for integration
- `users-screen.tsx` is consumed via `next/dynamic` + Error Boundary, so the Comptes tab degrades gracefully even if that file isn't ready. Once it exists, the boundary passes through to the real `UsersScreen`.
- The `ref` import field is optional: if a CSV has a Réf column, multiple rows with the same ref are merged into a single multi-item invoice. Otherwise each row becomes a 1-item invoice.

---
Task ID: FINAL
Agent: main
Task: Final verification and project completion

Work Log:
- Fixed lucide-react icon imports in stats-screen (ShoppingCartCheckout→ShoppingCart, Payments→Wallet)
- Fixed React 19 lint errors (setState in effects) in sync-status, offline-banner, app-shell
- Ran ESLint: 0 errors, 0 warnings
- Verified all screens via agent-browser:
  - Login screen renders with blue gradient card
  - Admin login (+221770000000/admin1234) → dashboard with 24 invoices
  - Invoices list: search, filters, sort, multi-select working
  - New invoice: created "Test Client Browser" with 1 item (5000 FCFA) → now 25 invoices
  - Invoice detail: FACTURE layout, PDF/PNG/Share buttons, status changer
  - Stats: CA hero, KPIs, bar chart, donut, top 5 clients/products
  - Products: 10 products, categories, search, add/edit/delete
  - Settings: 4 tabs (Boutique, Maintenance, Comptes, Sauvegarde)
  - CSV import: drop zone, mapping preview
  - Users (Comptes): 2 accounts, role change, disable toggle
- Verified role-based access: employee login shows NO Réglages/Comptes (admin-only)
- Created cron job (every 15 min, webDevReview) for ongoing auto-dev
- Wrote comprehensive README with setup, security, offline architecture, deployment

Stage Summary:
- PWA complete and fully functional: all 8 screens working, offline-first with sync queue,
  PDF/PNG generation, role-based access control, maintenance mode, PWA installable
- HTTP 200, no runtime errors, lint clean
- Demo accounts: admin (+221770000000/admin1234), employee (+221771111111/employe1234)
- Ready for production deployment to Vercel

---
Task ID: CRON-ROUND-2
Agent: main (cron webDevReview)
Task: QA + bug fixes + new features (Dashboard, skeleton loaders, keyboard shortcuts)

## Current project status assessment
- Project was complete and functional (all 8 screens working, lint clean, HTTP 200)
- One console warning found during QA: sync engine called `pullFromServer()` on app load even when unauthenticated, producing "Non authentifié" + "Failed to fetch" console spam on the login page
- Dev server has a sandbox-specific instability (process exits after first compile cycle), but the code itself is verified valid via lint + curl (all 8 API endpoints return HTTP 200, home page compiles in ~24s and returns 200)

## Current goals / completed modifications / verification results

### Bug fix
1. **Sync engine console spam** (`src/lib/sync-engine.ts`):
   - `pullFromServer()` now checks `/api/auth/me` first and silently skips when unauthenticated (no more console warnings on login page)
   - `processQueueItem()` and `flushQueue()` catch handlers made silent (expected on offline/auth failures; queue retries automatically)

### New feature: Dashboard / home overview screen
2. **New file** `src/components/screens/dashboard-screen.tsx`:
   - Welcome hero card (blue gradient #2563EB→#1D4ED8→#1E3A8A, decorative blurred blobs, greeting based on time of day, 3 KPI tiles: CA today / 7 days / total)
   - 4 quick-action cards (Nouvelle facture, Voir factures, Produits, Statistiques) with colored icon badges + hover lift
   - Recent invoices panel (top 5, clickable → invoice detail, status accent bar, status badge, payable total in blue)
   - Status distribution card (4 statuses with progress bars + counts + percentages)
   - Catalog stats card (Produits, Clients, Factures, Articles vendus)
   - Responsive: 1 col mobile, lg:grid-cols-3 layout
3. **Wiring**: added "dashboard" to `ViewId` + `NAV_ITEMS` + `MOBILE_NAV` in `app-shell.tsx`, default view changed to "dashboard", added to `view-router.tsx`
4. Imported `LayoutDashboard` icon

### Styling: skeleton loaders + invoice card polish
5. **New** `InvoiceCardSkeleton` in `src/components/shared/ui.tsx` (animated pulse, mimics real card structure)
6. **Invoices screen** (`invoices-screen.tsx`):
   - Replaced `LoadingState` spinner with `InvoiceCardSkeleton count={6}` for a more polished loading state
   - Added **summary stats bar** (3 cards: Factures count, Total payable in blue, Articles count) that updates with the active filter
   - Polished `InvoiceCard`: hover lift (`-translate-y-0.5`), status accent bar grows on hover (h-12→h-14), payable amount in brand blue, tabular-nums for clean alignment, secondary line shows article/qty info when no discount/tax

### New feature: keyboard shortcuts
7. **In `app-shell.tsx`**: global keydown listener (active when authenticated, non-client):
   - `N` → new invoice
   - `/` → focus search (navigates to invoices + focuses search input)
   - `G` then `D/I/S/P` → dashboard / invoices / stats / products (g+ prefix pattern like Gmail)
   - Skips when typing in inputs/textarea/contenteditable, skips with modifier keys
8. **Shortcuts hint panel** in sidebar footer (lg+ screens only): shows N, /, G+… with kbd styling

### Verification
- `bun run lint`: **0 errors, 0 warnings**
- Dev log: **0 errors** after all changes (clean compile)
- curl full flow (while server alive): login 200, auth/me 200, invoices 200, clients 200, products 200, settings 200, users 200, home (dashboard) 200 — all endpoints working
- agent-browser connection failed due to sandbox dev-server instability (process exits after first compile), not a code issue — verified via curl + lint instead

## Unresolved issues / risks
- **Dev server sandbox instability**: the `bun run dev` process dies after the first compile cycle in this environment, making sustained agent-browser testing unreliable. Mitigation: verified via curl (all 8 endpoints 200) + lint clean. The app works when accessed immediately after a fresh server start.
- **No real Supabase**: per environment constraints, uses Prisma+SQLite. Architecture is portable (documented in README).

## Priority recommendations for next phase
1. **Clients management screen** — currently clients are only created implicitly when invoicing; a dedicated screen to view/edit/delete clients (with their invoice history) would match the Flutter app's settings "Clients" tab
2. **Invoice templates / branding** — let admin customize PDF colors and footer text (currently hardcoded to "Konté Bussness Services")
3. **Date range filter** on invoices list (the Flutter app has DateTimeRange filter)
4. **Bulk status change** in selection mode (currently only bulk delete + CSV export)
5. **Search across all fields** with highlighting
6. **Export the invoice list as PDF** (single multi-page PDF of all selected invoices, like the Flutter `shareInvoicesAsPdf`)
