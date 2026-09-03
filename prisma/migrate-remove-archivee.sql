-- Execute once before deploying the status cleanup.
UPDATE "Invoice" SET "status" = 'livree' WHERE "status" = 'archivee';