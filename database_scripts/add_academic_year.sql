-- Add academic_year to enrollments table
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS academic_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_enrollments_year ON public.enrollments(academic_year);
