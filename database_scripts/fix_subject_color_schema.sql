-- Fix for 'color' column length in subjects table
-- Original length (20) was too short for Tailwind class strings
ALTER TABLE public.subjects ALTER COLUMN color TYPE VARCHAR(255);

-- Optional: Update default value to match full style if desired
ALTER TABLE public.subjects ALTER COLUMN color SET DEFAULT 'bg-indigo-100 text-indigo-800 border-indigo-200';
