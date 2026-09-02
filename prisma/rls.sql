-- Defense-in-depth for Supabase Data API access.
-- Prisma connects as postgres, which retains access as table owner.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settings" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['User', 'Invoice', 'InvoiceItem', 'Client', 'Product', 'Settings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "no_public_access" ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY "no_public_access" ON %I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      table_name
    );
  END LOOP;
END $$;