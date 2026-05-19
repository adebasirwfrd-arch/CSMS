-- Master Data: Client, Product Line, and per-combination Drive templates
-- Run in Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_lines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One Drive template folder per Client + Product Line pair
CREATE TABLE IF NOT EXISTS client_product_templates (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_line_id INT NOT NULL REFERENCES product_lines(id) ON DELETE CASCADE,
  template_folder_name TEXT NOT NULL,
  drive_folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, product_line_id)
);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS product_line_id INT REFERENCES product_lines(id);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_product_line ON projects(product_line_id);

-- RLS (required when Supabase enables RLS on new tables — same pattern as otp_month_data)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
CREATE POLICY "Allow all access to clients"
  ON public.clients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.product_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to product_lines" ON public.product_lines;
CREATE POLICY "Allow all access to product_lines"
  ON public.product_lines FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.client_product_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to client_product_templates" ON public.client_product_templates;
CREATE POLICY "Allow all access to client_product_templates"
  ON public.client_product_templates FOR ALL USING (true) WITH CHECK (true);
