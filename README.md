# Facturier Konté — PWA de Gestion de Factures

Application web professionnelle (PWA installable, fonctionnant hors ligne) reproduisant l'application Flutter [invoice_app](https://github.com/GHOSTOS-GH/invoice_app) en version web.

## Fonctionnalités

- **Authentification** par numéro de téléphone sénégalais (+221) + mot de passe
- **Rôles** : client (accès limité), employé (factures/clients/produits), admin (accès total + maintenance + gestion des comptes)
- **Factures** : création, modification, duplication, changement de statut, archivage, suppression
- **Calculs fidèles** : sous-total, remise, TVA, total à payer (identiques à `invoice.dart`)
- **Statuts** : En cours (#6B4C4C), En livraison (#FFC107), Livrée (#4CAF50), Archivée (#9E9E9E)
- **Clients & Produits** : gestion complète avec catégories et images
- **Statistiques** : chiffre d'affaires, KPIs, graphiques (bar + donut), top 5 clients/produits
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
| Base de données | Prisma ORM + SQLite |
| Auth | JWT (jose) + bcryptjs, cookies HTTP-only |
| Stockage hors ligne | IndexedDB via Dexie.js |
| Parsing CSV | PapaParse |
| Génération PDF | jsPDF + jspdf-autotable |
| Génération PNG | html2canvas |
| Graphiques | Recharts |
| PWA | manifest.json + Service Worker |

> **Note sur Supabase** : Le cahier des charges demandait Supabase. L'environnement de développement fourni utilise Prisma + SQLite. L'architecture est conçue pour être portable vers Supabase : les politiques RLS équivalentes sont implémentées côté serveur dans les API routes (`requireAuth`, `requireRole`), et le schéma Prisma est directement transposable en schéma Supabase. La couche offline (Dexie + sync queue) est identique quelle que soit la base de données distante.

## Démarrage rapide

### 1. Installation

```bash
bun install
```

### 2. Variables d'environnement

Créer un fichier `.env` à la racine :

```env
DATABASE_URL="file:./db/custom.db"
JWT_SECRET="votre-secret-jwt-tres-long-et-aleatoire"
```

### 3. Base de données

```bash
bun run db:push    # Crée les tables
bun run db:generate # Génère le client Prisma
```

### 4. Créer le premier compte admin

**Option A — Script de seed (recommandé pour le développement)**

```bash
bun scripts/seed.ts
```

Crée un admin (`+221770000000` / `admin1234`), un employé (`+221771111111` / `employe1234`), et des données de démonstration (produits, clients, 24 factures).

**Option B — API de bootstrap (production)**

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "Content-Type: application/json" \
  -d '{"phone":"+221770000000","password":"votre-mot-de-passe","name":"Admin"}'
```

> ⚠️ Cette route est désactivée dès qu'un compte admin existe. Elle refuse de s'exécuter en production si un admin est déjà présent.

**Option C — Modification manuelle en base (équivalent Supabase)**

```sql
-- Via un client SQLite ou Supabase SQL Editor
INSERT INTO User (id, phone, passwordHash, role, name, disabled, createdAt, updatedAt)
VALUES (
  lower(hex(randomblob(8))),
  '+221770000000',
  '$2a$10$...',  -- hash bcrypt du mot de passe
  'admin',
  'Administrateur',
  0,
  datetime('now'),
  datetime('now')
);
```

> **Sécurité** : Aucune action dans l'interface ne permet de devenir admin. Le rôle n'est assignable que par modification directe de la base ou par un admin existant via l'écran Comptes. Les nouveaux comptes créés via inscription ont toujours le rôle `client`.

### 5. Lancement

```bash
bun run dev
```

L'application est disponible sur `http://localhost:3000`.

## Sécurité — RLS équivalent

Chaque route API vérifie l'authentification et le rôle côté serveur (jamais côté client) :

| Table | Lecture | Écriture | Règle |
|-------|---------|----------|-------|
| invoices | employé/admin (les siennes) | employé/admin | Un client ne voit aucune facture |
| clients | employé/admin (les siens) | employé/admin | Un client n'a aucun accès |
| products | employé/admin (les siens) | employé/admin | Un client n'a aucun accès |
| settings | tout utilisateur connecté | admin uniquement | `requireRole("admin")` |
| users | admin uniquement | admin uniquement | `requireRole("admin")` |
| settings.maintenanceMode | — | admin uniquement | Vérifié côté serveur à chaque requête |

Les fonctions `requireAuth()` et `requireRole(min)` dans `src/lib/auth.ts` implémentent ces vérifications. Le rôle est toujours relu depuis la base de données (source de vérité), jamais depuis le JWT seul.

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
- **Invoice** : id, clientName, clientId, status (enCours/enLivraison/livree/archivee), notes, discount, taxRate, createdBy, createdAt, updatedAt
- **InvoiceItem** : id, invoiceId, name, quantity, unitPrice
- **Client** : id, name, phone, address, createdBy
- **Product** : id, name, category, imageUrl, createdBy
- **Settings** : id (singleton), maintenanceMode, shopName, shopAddress, shopPhone, shopNinea, footerMessage, logoUrl

### Calculs (identiques à invoice.dart)

```
subtotal_ligne   = quantity × unit_price
total_facture    = Σ subtotals
tax_amount       = (total − discount) × tax_rate / 100
payable_total    = total − discount + tax_amount
```

## Format CSV

Compatible avec l'export de l'app mobile. Séparateur `;` (convention française), encodage UTF-8 avec BOM pour Excel :

```
Date;Réf;Client;Statut;Article;Quantité;Prix unitaire;Sous-total;Total facture;Notes
01/09/2026 14:30;#a6jw10;Fatou Diop;En cours;Wax Hollandais;2;8000;16000;16000;
```

L'import supporte le mapping automatique des colonnes et le choix entre "Remplacer" ou "Fusionner".

## Déploiement sur Vercel

1. Pousser le code sur GitHub
2. Importer le dépôt sur [vercel.com](https://vercel.com)
3. Configurer les variables d'environnement :
   - `DATABASE_URL` — pour SQLite, utiliser un chemin persistant ; pour Supabase/Postgres, utiliser l'URL de connexion
   - `JWT_SECRET` — une chaîne aléatoire de 64+ caractères
4. Déployer
5. Créer le premier admin via l'API `/api/seed` (voir ci-dessus)

> **Migration vers Supabase** : remplacer `prisma/schema.prisma` (datasource → postgresql), créer les mêmes tables dans Supabase, ajouter les politiques RLS PostgreSQL équivalentes aux vérifications `requireAuth/requireRole`, puis remplacer `src/lib/db.ts` par le client Supabase. La couche frontend et offline reste inchangée.

## Installation PWA

1. Ouvrir l'application dans Chrome/Edge/Safari mobile
2. Menu → "Ajouter à l'écran d'accueil" / "Installer"
3. L'icône apparaît sur l'écran d'accueil
4. L'application fonctionne en plein écran, hors ligne

Sur desktop Chrome : cliquer sur l'icône "Installer" dans la barre d'adresse.

## Comptes de démonstration

| Rôle | Téléphone | Mot de passe |
|------|-----------|--------------|
| Admin | +221770000000 | admin1234 |
| Employé | +221771111111 | employe1234 |

## Scripts

```bash
bun run dev        # Développement (port 3000)
bun run lint       # ESLint
bun run db:push    # Synchroniser le schéma Prisma
bun run db:generate # Régénérer le client Prisma
bun scripts/seed.ts # Données de démonstration
```

## Licence

Solution conçue par Mohamed — Konté Bussness Services.
