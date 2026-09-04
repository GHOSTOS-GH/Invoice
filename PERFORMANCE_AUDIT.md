# Audit de performance

Date : 2026-09-04

Périmètre : audit en lecture seule après la pagination des factures, la désactivation du logging Prisma en production, le swipe à 115 px, le lazy loading de PapaParse/SheetJS et la déduplication CSV. Aucun correctif applicatif n'est appliqué par cet audit.

## Résumé exécutif

| Priorité | Sujet | Impact estimé | Action recommandée |
|---|---|---:|---|
| P0 | Chargements `all=true` avec tous les articles pour les agrégats | Très élevé avec le volume | Ajouter des endpoints d'agrégats SQL côté serveur |
| P1 | Routes clients/produits/users sans pagination | Élevé à moyen | Ajouter pagination/recherche serveur lorsque les catalogues grossissent |
| P1 | Bucket Storage vérifié à chaque upload | Élevé pour chaque upload | Créer/vérifier le bucket hors chemin critique |
| P1 | jsPDF chargé via le chemin de l'écran facture | Élevé sur le premier chargement | Charger le générateur PDF uniquement au clic |
| P1 | Import CSV clients/produits séquentiel | Élevé sur gros fichier | Batch API ou lots parallèles avec déduplication serveur |
| P2 | Recharts et écran statistiques | Moyen | Garder le chargement dynamique et envisager un endpoint d'agrégats |
| P2 | Historique client charge toutes les factures | Moyen/élevé | Endpoint d'historique paginé par client |
| P2 | Cache HTTP explicite absent | Moyen | Ajouter des headers ciblés pour assets immuables, jamais pour API privées |
| P3 | Re-renders et effets React | Faible à moyen | Stabiliser les options/hooks et profiler avant refactor |

## 1. Routes API restantes

### P1 — Clients et produits non paginés

- [src/app/api/clients/route.ts](src/app/api/clients/route.ts) effectue un `findMany` complet, trié par nom, et renvoie tous les champs du modèle.
- [src/app/api/products/route.ts](src/app/api/products/route.ts) effectue le même chargement complet, avec `imageUrl` dans chaque ligne.
- Le client utilise ces listes pour les suggestions et le sélecteur de produits, donc une pagination pure côté API nécessitera une recherche serveur (`?q=`) ou un endpoint de catalogue léger. Recommandation : ajouter `select` explicite et une limite/pagination ; ne pas charger les images comme données binaires, seulement leurs URLs.
- Risque actuel faible si le catalogue reste petit, mais la latence et la mémoire augmentent linéairement avec le nombre de clients/produits.

### P1 — Utilisateurs non paginés

- [src/app/api/users/route.ts](src/app/api/users/route.ts) charge tous les utilisateurs avec un `select` correct, sans relations ni `passwordHash`.
- Le risque est inférieur à celui des factures, mais une organisation avec beaucoup de comptes finira par charger une liste complète côté admin. Ajouter pagination et recherche par nom/téléphone lorsque le volume dépasse quelques centaines.

### P2 — Historique client non borné

- [src/app/api/clients/[id]/route.ts](src/app/api/clients/[id]/route.ts) inclut toutes les factures du client via `include: { invoices: { orderBy: ... } }`.
- Cette route peut devenir très lente pour un client actif. Recommandation : retourner le client séparément et ajouter `page/pageSize` pour son historique, avec `select` des champs nécessaires.

### P1 — Upload : création/vérification du bucket dans le chemin critique

- [src/app/api/upload/route.ts](src/app/api/upload/route.ts) appelle `ensureBucket()` avant chaque upload.
- Chaque image déclenche donc une requête d'administration Supabase supplémentaire et potentiellement une réponse d'erreur attendue si le bucket existe déjà.
- Recommandation : créer `product-images` une fois dans Supabase/CI et retirer `ensureBucket` du chemin normal. À défaut, utiliser un cache serveur de courte durée, sans supposer qu'un cache mémoire Vercel soit durable.
- Le parsing `dataUrl` avec `atob` crée une copie base64 en mémoire ; le multipart est préférable pour les fichiers mobiles volumineux.

### P2 — Settings et maintenance

- [src/app/api/settings/route.ts](src/app/api/settings/route.ts) utilise une clé singleton et une requête bornée : pas de besoin de pagination.
- [src/app/api/maintenance/route.ts](src/app/api/maintenance/route.ts) lit également une seule ligne : pas de problème de volume.
- La création automatique du singleton sur un GET est rare et fonctionnelle, mais peut être déplacée vers le déploiement/seed de configuration pour éviter une mutation sur un chemin de lecture.

### Déjà amélioré

- [src/app/api/invoices/route.ts](src/app/api/invoices/route.ts) limite la liste par défaut à 30 factures et expose `all=true` explicitement pour les consommateurs d'agrégats.
- Le logging Prisma de [src/lib/db.ts](src/lib/db.ts) est maintenant limité à `query` en développement et `error` ailleurs.

## 2. Hooks et composants React

### P0 — Agrégats calculés côté client sur toutes les factures

- [src/components/screens/dashboard-screen.tsx](src/components/screens/dashboard-screen.tsx), [src/components/screens/stats-screen.tsx](src/components/screens/stats-screen.tsx) et [src/components/screens/clients-screen.tsx](src/components/screens/clients-screen.tsx) utilisent `useInvoices({ all: true })`.
- Cela télécharge toutes les factures et tous leurs articles, puis recalcule CA, top clients, top produits et historique dans le navigateur.
- Le changement demandé a donc amélioré la liste, mais pas le dashboard/statistiques. Recommandation prioritaire : endpoints SQL d'agrégats par période/statut, par exemple CA, nombre de factures, quantité, top clients et top produits. Les pages ne devraient recevoir que les résultats agrégés.

### P2 — `useInvoices` et cache IndexedDB

- [src/lib/data-hooks.ts](src/lib/data-hooks.ts) reconstruit les données hors ligne en faisant `items.filter(...)` pour chaque facture, soit un coût potentiellement O(n*m).
- Le cache de chaque page est écrit ligne par ligne dans IndexedDB. Recommandation : indexer/charger les articles par `invoiceId` et utiliser une transaction/bulkPut pour les mises à jour importantes.
- Le même hook gère les modes paginé et `all`; à terme, séparer `useInvoicePage` et `useInvoiceAggregates` réduirait les branches et les risques de mauvais chargement.

### P2 — Rafraîchissements et dépendances

- Les hooks installent leurs listeners focus/événement de synchronisation et dépendent de `online`. C'est fonctionnel, mais chaque changement online recrée les callbacks et listeners.
- Le rafraîchissement manuel déclenche trois chargements simultanés (`invoices`, `clients`, `products`) depuis le bandeau. Recommandation : centraliser un `refreshAllData` avec état global de synchronisation et dédupliquer les appels simultanés.
- Le délai de focus est stocké dans la closure de l'effet. Un remount réinitialise ce délai ; ce n'est pas incorrect, mais un timestamp partagé rendrait le throttling cohérent entre écrans.

### P2 — Re-renders coûteux

- [src/components/screens/stats-screen.tsx](src/components/screens/stats-screen.tsx) mémoïse son calcul principal, ce qui est correct, mais le calcul reste proportionnel à toutes les factures et tous les articles.
- [src/components/screens/dashboard-screen.tsx](src/components/screens/dashboard-screen.tsx) mémoïse ses statistiques, mais charge aussi `useProducts` et `useClients` pour les compteurs. Vérifier que ces listes sont réellement nécessaires à chaque rendu du dashboard ; sinon les charger à la demande.
- [src/components/screens/settings-screen.tsx](src/components/screens/settings-screen.tsx) monte les hooks de sauvegarde dans le composant d'onglet. Les onglets non visibles peuvent donc préparer des données inutiles selon le rendu Radix utilisé. À profiler ; déplacer les hooks dans le contenu de l'onglet si nécessaire.
- [src/components/screens/clients-screen.tsx](src/components/screens/clients-screen.tsx) calcule l'historique complet de tous les clients avec `useMemo`, mais cette donnée est coûteuse et n'est utile qu'à la sélection d'un client. Préférer un chargement à la demande.
- Aucun `useMemo`/`useCallback` ne doit être ajouté mécaniquement : profiler avant de refactorer les composants de petite taille.

### P3 — Effets et qualité de rendu

- [src/components/screens/products-screen.tsx](src/components/screens/products-screen.tsx) réinitialise plusieurs états dans un `useEffect` à l'ouverture du dialogue. C'est acceptable pour un formulaire, mais ESLint signale ce pattern dans ce projet ; une initialisation par clé de dialogue ou un composant de formulaire remounté éviterait le rendu intermédiaire.
- [src/components/screens/settings-screen.tsx](src/components/screens/settings-screen.tsx) synchronise aussi plusieurs champs locaux depuis `settings` dans un effet. À conserver pour les données serveur, mais éviter de rafraîchir `settings` plus souvent que nécessaire.

## 3. Bundle et imports

### Mesure du build

- `npm run build` : réussi le 2026-09-04.
- Sortie Next observée : chunks JavaScript non compressés d'environ `517.9 KB`, `423.9 KB`, `379.8 KB`, puis `223.6 KB`, `193.4 KB`.
- Attribution par recherche dans les chunks : le plus gros contient `jspdf`, `html2canvas` et `xlsx`; un autre contient `xlsx`; un autre contient `recharts`.
- Ces tailles sont des tailles brutes de fichiers de build, pas les tailles gzip/brotli réellement transférées. Une mesure Lighthouse/DevTools reste nécessaire pour le poids réseau et le TTI.

### P1 — jsPDF encore trop tôt dans le chemin facture

- [src/lib/pdf-generator.ts](src/lib/pdf-generator.ts) importe statiquement `jspdf` et `jspdf-autotable`.
- [src/components/screens/invoice-detail-screen.tsx](src/components/screens/invoice-detail-screen.tsx) importe statiquement `generateInvoicePdf`, alors que PDF n'est utilisé qu'après un clic.
- Recommandation : déplacer l'import du générateur PDF dans `handlePdf` et `shareAs("pdf")`. Le composant facture ne devrait pas embarquer jsPDF au premier affichage.

### P2 — Recharts

- [src/components/screens/stats-screen.tsx](src/components/screens/stats-screen.tsx) importe Recharts statiquement, mais l'écran est déjà chargé via `next/dynamic` dans [src/components/view-router.tsx](src/components/view-router.tsx). L'optimisation est donc déjà correcte au niveau du démarrage principal.
- [src/components/ui/chart.tsx](src/components/ui/chart.tsx) importe aussi toute la primitive Recharts. Vérifier si ce composant est importé par un écran initial ; sinon le maintenir dans les chunks dynamiques, sinon découper les graphiques réellement utilisés.

### P2 — SheetJS et PapaParse

- PapaParse est maintenant chargé dynamiquement dans les imports ponctuels.
- SheetJS est maintenant chargé dynamiquement dans `exportExcel` de [src/lib/export-utils.ts](src/lib/export-utils.ts). Vérifier après analyse bundle que le chunk `xlsx` n'est plus dans le chargement initial ; sa présence dans les chunks générés n'est pas nécessairement un problème si le chunk est différé.

### P2 — Dexie

- [src/lib/offline-db.ts](src/lib/offline-db.ts) importe Dexie statiquement depuis les hooks client. Comme le mode offline est transversal, le coût peut être justifié, mais il faut mesurer son poids dans le chunk initial. Une séparation plus poussée demanderait de charger Dexie uniquement après authentification ou lors du premier accès aux données offline.

### P3 — Framer Motion et autres dépendances

- Vérifier l'usage réel de `framer-motion`, `@mdxeditor/editor`, `z-ai-web-dev-sdk`, `sharp` et autres dépendances lourdes listées dans [package.json](package.json). Toute dépendance non utilisée augmente installation, audit et risque de bundle indirect.
- Faire cette vérification avec `npm ls`, l'analyse du bundle et un import trace avant suppression ; aucune suppression automatique recommandée dans cet audit.

## 4. Next.js, images, cache et Vercel

### P1 — `typescript.ignoreBuildErrors`

- [next.config.ts](next.config.ts) active `typescript.ignoreBuildErrors: true`.
- Ce réglage ne ralentit pas directement l'exécution, mais permet de déployer des régressions TypeScript et masque des erreurs dans le pipeline. Le build actuel saute donc la validation de types ; réactiver la validation après correction des erreurs existantes doit être une priorité de fiabilité/performance opérationnelle.

### P1 — Incohérence avec le packaging standalone local

- `next.config.ts` n'utilise plus `output: "standalone"`, tandis que [.zscripts/build.sh](.zscripts/build.sh) contient encore une logique d'auto-réparation et de packaging standalone.
- Vercel peut fonctionner avec le preset Next.js standard, mais ce script de déploiement alternatif peut reconstruire ou modifier la configuration de manière inattendue. Décider explicitement si le projet cible Vercel standard ou le packaging standalone, puis supprimer le chemin non utilisé.

### P2 — Images distantes

- `remotePatterns` autorise `**.supabase.co`, ce qui est fonctionnel pour les URLs Storage, mais plus large que nécessaire. Restreindre au hostname exact du projet Supabase réduirait la surface de configuration.
- Les cartes produit utilisent `next/image`, ce qui est correct. Le logo de boutique dans [src/components/screens/settings-screen.tsx](src/components/screens/settings-screen.tsx) utilise encore `<img>` ; passer aussi par `next/image` avec dimensions stables permettrait optimisation et lazy loading, sous réserve de gérer les previews data URL.

### P2 — Headers/cache

- Aucun `vercel.json` n'est présent à la racine et aucun `headers()` n'est configuré dans [next.config.ts](next.config.ts).
- Les assets Next hashés bénéficient déjà du cache Vercel par défaut. En revanche, les réponses API privées ne doivent pas être mises en cache publiquement ; ajouter explicitement `Cache-Control: private, no-store` aux routes authentifiées pourrait éviter un cache intermédiaire incorrect.
- Les requêtes GET de catalogue et de settings pourraient éventuellement utiliser un cache privé très court, mais seulement avec invalidation après mutation. Ne pas mettre en cache publiquement des données d'entreprise.

### P2 — Service Worker

- [public/sw.js](public/sw.js) met les API en réseau uniquement, ce qui protège la fraîcheur des factures/clients/produits.
- Les navigations sont mises en cache au fil des requêtes. C'est utile hors ligne, mais il faut vérifier la taille cumulée et prévoir une stratégie de nettoyage/limite si beaucoup de routes et réponses HTML sont visitées.
- Les assets sont cache-first, mais le cache shell initial est réduit aux icônes et au manifest ; le premier chargement reste dépendant du réseau. C'est un choix cohérent, à mesurer sur mobile plutôt qu'à modifier sans données.

### P3 — Configuration React/Next

- `reactStrictMode: false` dans [next.config.ts](next.config.ts) n'améliore pas le bundle de production et réduit la détection des effets non idempotents en développement. Le réactiver est recommandé après correction des effets signalés, surtout pour prévenir les doubles abonnements en développement.

## 5. Routes sans besoin immédiat de pagination

- [src/app/api/settings/route.ts](src/app/api/settings/route.ts) : singleton, borné.
- [src/app/api/maintenance/route.ts](src/app/api/maintenance/route.ts) : singleton, borné.
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts), register et me : accès par clé unique, borné.
- [src/app/api/products/[id]/route.ts](src/app/api/products/[id]/route.ts), clients `[id]` et invoices `[id]` : accès par identifiant ; l'historique client est l'exception non bornée décrite plus haut.
- [src/app/api/users/[id]/role/route.ts](src/app/api/users/[id]/role/route.ts) et disable : accès par identifiant, borné.

## 6. Plan recommandé

1. Ajouter des endpoints d'agrégats SQL pour dashboard/statistiques et un historique client paginé.
2. Charger jsPDF et ses plugins uniquement au clic PDF/partage.
3. Retirer `ensureBucket` du chemin normal d'upload et créer le bucket dans Supabase/CI.
4. Ajouter pagination/recherche serveur pour clients, produits et utilisateurs selon les volumes réels.
5. Mesurer le bundle initial et le TTI mobile avec Lighthouse/DevTools après le découpage PDF.
6. Réactiver le typecheck du build et traiter les erreurs existantes avant de supprimer `ignoreBuildErrors`.
7. Clarifier le pipeline Vercel standard versus le packaging standalone `.zscripts`.
