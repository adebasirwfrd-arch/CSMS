-- =============================================
-- HSE Personnel Matrix (PTS Wells Excel tabs)
-- Paste di Supabase SQL Editor → Run
-- Pola sama: RLS + policy allow all (seperti otp_month_data / clients)
-- =============================================

CREATE TABLE IF NOT EXISTS public.matrix_sheets (
  id text PRIMARY KEY,
  name text NOT NULL,
  title text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matrix_columns (
  sheet_id text NOT NULL REFERENCES public.matrix_sheets(id) ON DELETE CASCADE,
  id text NOT NULL,
  col_key text,
  label text NOT NULL,
  col_type text DEFAULT 'text',
  filterable boolean DEFAULT true,
  is_required boolean DEFAULT false,
  sort_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (sheet_id, id)
);

CREATE INDEX IF NOT EXISTS idx_matrix_columns_sheet ON public.matrix_columns(sheet_id);

CREATE TABLE IF NOT EXISTS public.matrix_rows (
  id text PRIMARY KEY,
  sheet_id text NOT NULL REFERENCES public.matrix_sheets(id) ON DELETE CASCADE,
  cells jsonb DEFAULT '{}'::jsonb NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matrix_rows_sheet ON public.matrix_rows(sheet_id);

ALTER TABLE public.matrix_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to matrix_sheets" ON public.matrix_sheets;
CREATE POLICY "Allow all access to matrix_sheets"
  ON public.matrix_sheets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to matrix_columns" ON public.matrix_columns;
CREATE POLICY "Allow all access to matrix_columns"
  ON public.matrix_columns FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to matrix_rows" ON public.matrix_rows;
CREATE POLICY "Allow all access to matrix_rows"
  ON public.matrix_rows FOR ALL USING (true) WITH CHECK (true);

SELECT 'Done! matrix_sheets, matrix_columns, matrix_rows created' AS status;
