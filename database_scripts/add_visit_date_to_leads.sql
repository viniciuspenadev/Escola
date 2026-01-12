-- Add visit_date column to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS visit_date TIMESTAMPTZ;

-- Add index for efficient calendar queries
CREATE INDEX IF NOT EXISTS leads_visit_date_idx ON public.leads(visit_date);
