# Facturier Konté — PWA de Gestion de Factures

Application web professionnelle (PWA installable, fonctionnant hors ligne) reproduisant l'application Flutter [invoice_app](https://github.com/GHOSTOS-GH/invoice_app) en version web.

## Fonctionnalités

- **Authentification** par numéro de téléphone sénégalais (+221) + mot de passe
- **Rôles** : client (accès limité), employé (factures/clients/produits), admin (accès total + maintenance + gestion des comptes)
- **Factures** : création, modification, duplication, changement de statut, suppression
- **Calculs fidèles** : sous-total et total à payer sans TVA ni remise
- **Statuts** : En cours (#6B4C4C), En livraison (#FFC107), Livrée (#4CAF50)
- **Clients & Produits** : gestion complète avec catégories et images
- **Statistiques** : chiffre d'affaires des factures en livraison ou livrées, KPIs, graphiques (bar + donut), top 5 clients/produits
- **Import/Export CSV** : compatible avec l'historique de l'app mobile
- **Génération PDF** : mise en page identique à `pdf_service.dart`
- **Génération PNG** : pour partage WhatsApp/réseaux sociaux
- **Partage natif** : Web Share API sur mobile, fallback téléchargement sur desktop
- **Mode maintenance** : fermeture du site aux non-admins
- **PWA installable** : icône sur l'écran d'accueil, fonctionne hors ligne
- **Offline-first** : IndexedDB (Dexie.js) + queue de synchronisation automatique
- **Synchro "dernière écriture gagne"** : basée sur `updated_at`

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide icons |
| Base de données | Prisma ORM + PostgreSQL (Supabase) |
| Auth | JWT (jose) + bcryptjs, cookies HTTP-only |
| Stockage hors ligne | IndexedDB via Dexie.js |
| Parsing CSV | PapaParse |
| Génération PDF | jsPDF + jspdf-autotable |
| Génération PNG | html2canvas |
| Graphiques | Recharts |
| PWA | manifest.json + Service Worker |

> **Note sur Supabase** : Prisma utilise la base PostgreSQL Supabase. La couche offline (Dexie + sync queue) est identique quelle que soit la base de données distante.

## Démarrage rapide

### 1. Installation

```bash
bun install
```

### 2. Variables d'environnement

Créer un fichier `.env` à la racine :

```env
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<MOT_DE_PASSE>@<POOLER_HOST>:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<PROJECT_REF>:<MOT_DE_PASSE>@<DIRECT_HOST>:5432/postgres"
JWT_SECRET="votre-secret-jwt-tres-long-et-aleatoire"
SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<CLE_SERVICE_ROLE_SUPABASE>"
```

Copier les deux URLs depuis le tableau de bord Supabase. Ne jamais commiter `.env` ni le mot de passe réel.
`SUPABASE_SERVICE_ROLE_KEY` est une clé serveur strictement privée : elle est nécessaire pour envoyer les images vers le bucket `product-images` et ne doit jamais commencer par `NEXT_PUBLIC_`.

Avant le déploiement, créer manuellement dans Supabase Storage un bucket public nommé `product-images`. L'API Next.js utilise `SUPABASE_SERVICE_ROLE_KEY` pour écrire dans ce bucket et ne tente pas de le créer à chaque upload.

Dans Supabase : **Storage → New bucket → Name `product-images` → Public bucket activé → Create bucket**. Vérifier ensuite que les fichiers sont lisibles via l’URL publique Storage. La clé `service_role` reste uniquement dans les variables privées Vercel Production et Preview.

Le fichier `.env` est déjà exclu du dépôt par `.gitignore`. Pour vérifier qu'il est bien ignoré :

```bash
git check-ignore -v .env
```

### 3. Base de données

```bash
npx prisma generate
npx prisma db push    # Crée les tables sur Supabase
npx prisma db execute --file prisma/rls.sql --schema prisma/schema.prisma
```

### 4. Créer le premier compte admin

**Option A — Script de seed (recommandé pour le développement)**

```bash
bun scripts/seed.ts
```

Si la commande `bun` n'est pas reconnue sous Windows, redémarrer le terminal après l'installation. Il est aussi possible de vérifier directement l'installation avec :

```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" --version
```

Le projet ne contient aucun seed ni compte préconfiguré. Créer le premier compte depuis l'écran d'inscription, puis gérer son rôle via une procédure d'administration sécurisée.

> **Sécurité** : Aucune action dans l'interface ne permet de devenir admin. Le rôle n'est assignable que par modification directe de la base ou par un admin existant via l'écran Comptes. Les nouveaux comptes créés via inscription ont toujours le rôle `client`.

### 5. Lancement

```bash
bun run dev
```

L'application est disponible sur `http://localhost:3000`.

## Sécurité — RLS équivalent

Chaque route API vérifie l'authentification et le rôle côté serveur (jamais côté client). Le rôle est toujours relu depuis la base de données (source de vérité), jamais depuis le JWT seul. En complément, `prisma/rls.sql` active RLS et bloque les rôles `anon` et `authenticated` de la Data API Supabase. RLS est une défense en profondeur, pas le mécanisme principal : l'autorité reste dans les routes Next.js via `requireAuth` et `requireRole`.

### Tableau récapitulatif des routes API et rôles minimum

| Route API | Méthode | Rôle minimum | Vérification |
|-----------|---------|-------------|--------------|
| `/api/auth/login` | POST | public | — |
| `/api/auth/register` | POST | public | — (nouveau compte = toujours `client`) |
| `/api/auth/logout` | POST | authentifié | `requireAuth()` |
| `/api/auth/me` | GET | authentifié | `requireAuth()` |
| `/api/maintenance` | GET | public | — (pour l'écran de login) |
| `/api/invoices` | GET | employé | `requireAuth()` + client→403 |
| `/api/invoices/[id]` | GET | employé | `requireAuth()` + client→403 |
| `/api/invoices/[id]` | PUT | employé | `requireAuth()` + client→403 |
| `/api/invoices/[id]` | DELETE | employé | `requireAuth()` + client→403 |
| `/api/clients` | GET | employé | `requireAuth()` + client→[] |
| `/api/clients` | POST | employé | `requireAuth()` + client→403 |
| `/api/clients/[id]` | GET/PUT/DELETE | employé | `requireAuth()` + client→403 |
| `/api/products` | GET | employé | `requireAuth()` (lecture pour le sélecteur de facture) |
| `/api/products` | POST | **admin** | `requireRole("admin")` |
| `/api/products/[id]` | PUT | **admin** | `requireRole("admin")` |
| `/api/products/[id]` | DELETE | **admin** | `requireRole("admin")` |
| `/api/settings` | GET | authentifié | `requireAuth()` |
| `/api/settings` | PUT | **admin** | `requireRole("admin")` |
| `/api/users` | GET | **admin** | `requireRole("admin")` |
| `/api/users/[id]/role` | PUT | **admin** | `requireRole("admin")` + auto-protection |
| `/api/users/[id]/disable` | PUT | **admin** | `requireRole("admin")` + auto-protection |
| `/api/upload` | POST | employé | `requireAuth()` + client→403 |

### Ce qu'un employé ne peut JAMAIS faire (même en modifiant les requêtes côté client)

- ❌ Changer son propre rôle ou celui d'un autre compte → `requireRole("admin")` sur `/api/users/[id]/role`
- ❌ Activer/désactiver le mode maintenance → `requireRole("admin")` sur `/api/settings` PUT
- ❌ Modifier les informations de la boutique → `requireRole("admin")` sur `/api/settings` PUT
- ❌ Créer, modifier ou supprimer un produit → `requireRole("admin")` sur `/api/products` POST et `/api/products/[id]` PUT/DELETE
- ❌ Désactiver ou supprimer un autre compte → `requireRole("admin")` sur `/api/users/[id]/disable`
- ❌ Voir la liste des comptes utilisateurs → `requireRole("admin")` sur `/api/users` GET

Toutes ces vérifications sont effectuées **côté serveur** via les fonctions `requireAuth()` et `requireRole("admin")` dans `src/lib/auth.ts`. Le rôle est toujours relu depuis la base de données, jamais depuis le JWT seul.

## Architecture offline-first

```
┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│  Interface  │────▶│  IndexedDB       │────▶│  Sync Queue│
│  (React)    │     │  (Dexie.js)      │     │  ( Dexie ) │
└─────────────┘     └──────────────────┘     └─────┬──────┘
                                                   │ navigator.onLine
                                                   ▼
                                            ┌────────────┐
                                            │  API Next  │
                                            │  (Prisma)  │
                                            └────────────┘
```

1. **Toute mutation** (créer/modifier/supprimer) est d'abord écrite dans IndexedDB, puis envoyée à l'API. Si l'API échoue (hors ligne), l'opération est mise en file d'attente (`enqueueSync`).
2. **Au retour de connexion** (`online` event), le moteur de sync (`src/lib/sync-engine.ts`) vide la file vers l'API, puis tire les données canoniques du serveur.
3. **Résolution de conflits** : "dernière écriture gagne" basée sur `updatedAt` — le serveur conserve toujours l'horodatage le plus récent.
4. **Indicateur visuel** : un bandeau sticky affiche l'état hors ligne, la synchro en cours, et le nombre d'opérations en attente.

## Structure du projet

```
src/
├── app/
│   ├── api/                    # Routes API (RLS équivalent)
│   │   ├── auth/               # login, register, logout, me
│   │   ├── invoices/[id]/      # GET, PUT (upsert), DELETE
│   │   ├── clients/[id]/       # GET, PUT, DELETE
│   │   ├── products/[id]/      # PUT, DELETE
│   │   ├── settings/           # GET, PUT (admin)
│   │   ├── users/              # GET (admin), [id]/role, [id]/disable
│   │   ├── maintenance/        # GET (public)
│   │   ├── upload/             # POST (images)
│   │   └── seed/               # POST (bootstrap admin)
│   ├── layout.tsx              # PWA metadata + providers
│   └── page.tsx                # Vérifie maintenance → AppShell
├── components/
│   ├── app-shell.tsx           # Sidebar + bottom nav + routing
│   ├── view-router.tsx         # Switch entre écrans
│   ├── auth/login-screen.tsx   # Connexion/inscription
│   ├── screens/                # Écrans métier
│   │   ├── invoices-screen.tsx
│   │   ├── new-invoice-screen.tsx
│   │   ├── invoice-detail-screen.tsx
│   │   ├── products-screen.tsx
│   │   ├── stats-screen.tsx
│   │   ├── settings-screen.tsx
│   │   ├── csv-import-screen.tsx
│   │   └── users-screen.tsx
│   ├── shared/                 # UI partagée (banner, badges, etc.)
│   └── ui/                     # shadcn/ui
├── lib/
│   ├── constants.ts            # Design tokens, statuts, rôles
│   ├── types.ts                # Types + calculs (invoice.dart)
│   ├── formatters.ts           # FCFA, dates, CSV
│   ├── auth.ts                 # JWT, bcrypt, requireAuth/Role
│   ├── auth-context.tsx        # Context React auth
│   ├── db.ts                   # Client Prisma
│   ├── data-hooks.ts           # Hooks data (useInvoices, etc.)
│   ├── offline-db.ts           # Dexie IndexedDB + sync queue
│   ├── sync-engine.ts          # Moteur de synchronisation
│   └── pdf-generator.ts        # jsPDF (pdf_service.dart)
└── ...
```

## Modèle de données

Reproduit fidèlement `lib/models/invoice.dart` et `lib/models/product.dart` :

- **User** : id, phone (+221), passwordHash, role (client/employee/admin), name, disabled
- **Invoice** : id, clientName, clientId, status (enCours/enLivraison/livree), notes, createdBy, createdAt, updatedAt
- **InvoiceItem** : id, invoiceId, name, quantity, unitPrice
- **Client** : id, name, phone, address, createdBy
- **Product** : id, name, category, imageUrl, createdBy
- **Settings** : id (singleton), maintenanceMode, shopName, shopAddress, shopPhone, shopNinea, footerMessage, logoUrl

### Calculs (identiques à invoice.dart)

```
subtotal_ligne   = quantity × unit_price
total_facture    = Σ subtotals
payable_total    = total
```

## Format CSV

Compatible avec l'export de l'app mobile. Séparateur `;` (convention française), encodage UTF-8 avec BOM pour Excel :

```
Date;Réf;Client;Statut;Article;Quantité;Prix unitaire;Sous-total;Total facture;Notes
01/09/2026 14:30;#a6jw10;Fatou Diop;En cours;Wax Hollandais;2;8000;16000;16000;
```

L'import supporte le mapping automatique des colonnes et le choix entre "Remplacer" ou "Fusionner". Les clients et produits absents sont créés automatiquement, sans doublons (comparaison insensible à la casse et aux espaces), avant la création des factures.

Le chiffre d'affaires affiché dans les statistiques et le tableau de bord inclut uniquement les factures `enLivraison` ou `livree`. Les factures `enCours` sont exclues jusqu'à leur livraison.

La liste des factures est chargée par pages de 30 avec le bouton **Charger plus**. Le tableau de bord et les statistiques utilisent explicitement le chargement complet nécessaire à leurs agrégats. Les exports Excel/SheetJS et PapaParse sont chargés uniquement lorsque l'action correspondante est utilisée.

## Déploiement sur Vercel

1. Pousser le code sur GitHub. Le fichier `.env` reste local et n'est pas versionné.
2. Importer le dépôt sur [vercel.com](https://vercel.com).
3. Configurer les variables d'environnement Vercel :
   - `DATABASE_URL` : URL poolée Supabase, port `6543`, avec `pgbouncer=true`.
   - `DIRECT_URL` : URL directe Supabase, port `5432`, utilisée par Prisma.
   - `JWT_SECRET` : chaîne aléatoire d'au moins 64 caractères.
  - `SUPABASE_URL` : URL du projet Supabase, par exemple `https://<PROJECT_REF>.supabase.co`.
  - `SUPABASE_SERVICE_ROLE_KEY` : clé `service_role` Supabase, uniquement côté serveur.
4. Déployer l'application.
5. Appliquer le schéma et RLS depuis un environnement disposant des URLs Supabase :

```bash
npx prisma generate
npx prisma db push
npx prisma db execute --file prisma/rls.sql --schema prisma/schema.prisma
```

6. Créer le premier compte depuis l'inscription, puis lui attribuer le rôle administrateur avec une procédure SQL protégée.

Le bucket Storage `product-images` est créé automatiquement au premier upload et rendu public en lecture. L'écriture reste protégée par l'API Next.js et `requireAuth`.

## Installation PWA

1. Ouvrir l'application dans Chrome/Edge/Safari mobile
2. Menu → "Ajouter à l'écran d'accueil" / "Installer"
3. L'icône apparaît sur l'écran d'accueil
4. L'application fonctionne en plein écran, hors ligne

Sur desktop Chrome : cliquer sur l'icône "Installer" dans la barre d'adresse.

## Scripts

```bash
bun run dev        # Développement (port 3000)
bun run lint       # ESLint
bun run db:push    # Synchroniser le schéma Prisma
bun run db:generate # Régénérer le client Prisma
```

## Licence

Solution conçue par Mohamed — Konté Bussness Services.
