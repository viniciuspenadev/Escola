
-- Add details column to enrollments for storing wizard form data
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
