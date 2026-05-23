-- Employee job data per Product Line (from Employee_Job_Data Excel)
-- Run in Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS product_line_employees (
  id SERIAL PRIMARY KEY,
  product_line_id INT NOT NULL REFERENCES product_lines(id) ON DELETE CASCADE,
  row_no INT,
  name TEXT NOT NULL DEFAULT '',
  job_family_description TEXT DEFAULT '',
  job_description TEXT DEFAULT '',
  access_to_pl TEXT DEFAULT '',
  access_personnel_only TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pl_employees_product_line
  ON product_line_employees(product_line_id);

CREATE INDEX IF NOT EXISTS idx_pl_employees_row_no
  ON product_line_employees(product_line_id, row_no);

ALTER TABLE public.product_line_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to product_line_employees" ON public.product_line_employees;
CREATE POLICY "Allow all access to product_line_employees"
  ON public.product_line_employees FOR ALL USING (true) WITH CHECK (true);

SELECT 'product_line_employees table ready' AS status;
