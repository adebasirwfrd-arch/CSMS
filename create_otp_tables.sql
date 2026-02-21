-- =============================================
-- OTP Monthly Data Table (references ll_indicators)
-- Paste di Supabase SQL Editor → Run
-- =============================================

-- Drop old otp_programs table jika ada
DROP TABLE IF EXISTS public.otp_programs CASCADE;

-- Drop existing policy & table jika ada, lalu buat ulang
DROP POLICY IF EXISTS "Allow all access to otp_month_data" ON public.otp_month_data;
DROP TABLE IF EXISTS public.otp_month_data;

-- Buat tabel data bulanan per indicator
CREATE TABLE public.otp_month_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_id uuid NOT NULL,  -- references ll_indicators.id
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  plan integer DEFAULT 0,
  actual integer DEFAULT 0,
  wpts_id text,
  plan_date text,
  impl_date text,
  pic_name text,
  pic_email text,
  pic_manager text,
  pic_manager_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(indicator_id, month)
);

-- RLS Policy
ALTER TABLE public.otp_month_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to otp_month_data" ON public.otp_month_data FOR ALL USING (true) WITH CHECK (true);

SELECT 'Done! otp_month_data created - uses ll_indicators data' AS status;
