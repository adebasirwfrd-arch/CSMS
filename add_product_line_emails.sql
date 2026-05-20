-- Email reminder per Product Line (Matrix expiry 90 hari)
-- Paste di Supabase SQL Editor → Run

ALTER TABLE public.product_lines
  ADD COLUMN IF NOT EXISTS supervisor_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hse_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS manager_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS coordinator_email text DEFAULT '';

CREATE TABLE IF NOT EXISTS public.matrix_reminder_log (
  id bigserial PRIMARY KEY,
  sheet_id text NOT NULL,
  row_id text NOT NULL,
  col_id text NOT NULL,
  expiry_date date NOT NULL,
  reminder_days integer NOT NULL DEFAULT 90,
  sent_at timestamptz DEFAULT now(),
  UNIQUE (sheet_id, row_id, col_id, expiry_date, reminder_days)
);

ALTER TABLE public.matrix_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all matrix_reminder_log" ON public.matrix_reminder_log;
CREATE POLICY "Allow all matrix_reminder_log"
  ON public.matrix_reminder_log FOR ALL USING (true) WITH CHECK (true);

SELECT 'Done! product_lines email columns + matrix_reminder_log' AS status;
