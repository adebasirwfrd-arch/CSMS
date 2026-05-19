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
