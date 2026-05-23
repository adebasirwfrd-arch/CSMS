-- Add email_reminder column for Master employee CRUD (Yes/No dropdown)
ALTER TABLE public.product_line_employees
  ADD COLUMN IF NOT EXISTS email_reminder TEXT NOT NULL DEFAULT 'No';

SELECT 'product_line_employees.email_reminder ready' AS status;
