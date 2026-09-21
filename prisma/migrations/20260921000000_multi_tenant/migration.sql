-- Migration multi-tenant : passage mono-entreprise → SaaS multi-clients
-- Application : `npx prisma migrate dev` (dev) ou `npx prisma migrate deploy` (prod).
-- En environnement sans historique de migrations, `npx prisma db push` reproduit ce schéma.

-- 1) Nouveaux champs d'approbation / abonnement / signalement de paiement sur User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paymentClaimedAt" TIMESTAMP(3);

-- 2) Rôles : suppression des anciens rôles "employee"/"admin".
--    Les comptes "admin" existants deviennent "superadmin" ; les autres deviennent "client".
UPDATE "User" SET "role" = 'superadmin' WHERE "role" = 'admin';
UPDATE "User" SET "role" = 'client' WHERE "role" IN ('employee', 'admin');
-- Les comptes déjà existants sont considérés comme approuvés et actifs
-- (ils utilisaient déjà l'application avant la migration).
UPDATE "User" SET "isApproved" = true, "subscriptionStatus" = 'active' WHERE "role" = 'client';

-- 3) Settings : un réglage par utilisateur (au lieu du singleton global)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Attache les réglages existants au premier superadmin (fallback : premier utilisateur).
DO $$
DECLARE
  fallback_user TEXT;
BEGIN
  SELECT "id" INTO fallback_user FROM "User" WHERE "role" = 'superadmin' ORDER BY "createdAt" LIMIT 1;
  IF fallback_user IS NULL THEN
    SELECT "id" INTO fallback_user FROM "User" ORDER BY "createdAt" LIMIT 1;
  END IF;
  UPDATE "Settings" SET "userId" = fallback_user WHERE "userId" IS NULL;
END $$;

UPDATE "Settings" SET "id" = 'settings_' || "userId" WHERE "id" = 'singleton';
CREATE UNIQUE INDEX IF NOT EXISTS "Settings_userId_key" ON "Settings"("userId");
ALTER TABLE "Settings"
  ALTER COLUMN "userId" SET NOT NULL,
  DROP CONSTRAINT IF EXISTS "Settings_userId_fkey";
ALTER TABLE "Settings"
  ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Index d'isolation multi-tenant
CREATE INDEX IF NOT EXISTS "Invoice_createdBy_createdAt_idx" ON "Invoice"("createdBy", "createdAt");
CREATE INDEX IF NOT EXISTS "Client_createdBy_name_idx" ON "Client"("createdBy", "name");
CREATE INDEX IF NOT EXISTS "Product_createdBy_category_idx" ON "Product"("createdBy", "category");
CREATE INDEX IF NOT EXISTS "User_isApproved_subscriptionStatus_idx" ON "User"("isApproved", "subscriptionStatus");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
