-- Destructive reset: run manually in the Supabase SQL editor only after backup.
-- Replace the placeholder with the phone number of the real administrator.
DELETE FROM "InvoiceItem";
DELETE FROM "Invoice";
DELETE FROM "Client";
DELETE FROM "Product";
DELETE FROM "User" WHERE "phone" <> '<PHONE_ADMIN_REEL>';