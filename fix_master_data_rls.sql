-- Fix: "new row violates row-level security policy for table clients"
-- Paste di Supabase SQL Editor → Run
-- Pola sama dengan create_otp_tables.sql (backend pakai SUPABASE_KEY / anon key)

-- clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
CREATE POLICY "Allow all access to clients"
  ON public.clients
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- product_lines
ALTER TABLE public.product_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to product_lines" ON public.product_lines;
CREATE POLICY "Allow all access to product_lines"
  ON public.product_lines
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- client_product_templates
ALTER TABLE public.client_product_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to client_product_templates" ON public.client_product_templates;
CREATE POLICY "Allow all access to client_product_templates"
  ON public.client_product_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

SELECT 'Done! RLS policies for clients, product_lines, client_product_templates' AS status;
