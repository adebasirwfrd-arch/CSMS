-- =============================================
-- OTP Tables: otp_programs + otp_month_data
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create otp_programs table
CREATE TABLE IF NOT EXISTS public.otp_programs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  name text NOT NULL,
  guidance text,
  plan_type text DEFAULT 'Annually',
  due_date text,
  sort_order integer DEFAULT 0,
  year integer DEFAULT 2025,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create otp_month_data table
CREATE TABLE IF NOT EXISTS public.otp_month_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id uuid REFERENCES public.otp_programs(id) ON DELETE CASCADE,
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
  UNIQUE(program_id, month)
);

-- 3. Disable RLS (same as other tables)
ALTER TABLE public.otp_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_month_data ENABLE ROW LEVEL SECURITY;

-- Allow all access (match existing tables)
CREATE POLICY "Allow all access to otp_programs" ON public.otp_programs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to otp_month_data" ON public.otp_month_data FOR ALL USING (true) WITH CHECK (true);

-- 4. Verify
SELECT 'otp_programs created' AS status;
SELECT 'otp_month_data created' AS status;
