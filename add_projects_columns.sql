-- Add missing columns to projects table (fixes PGRST204 on POST /projects)
-- Paste in Supabase SQL Editor → Run

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS well_name text,
  ADD COLUMN IF NOT EXISTS kontrak_no text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS rig_down_date date,
  ADD COLUMN IF NOT EXISTS rig_down text,
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS pic_email text,
  ADD COLUMN IF NOT EXISTS pic_manager_email text,
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Ongoing',
  ADD COLUMN IF NOT EXISTS client_id int REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS product_line_id int REFERENCES public.product_lines(id);

CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_product_line ON public.projects(product_line_id);

SELECT 'Done! projects columns added/verified' AS status;
