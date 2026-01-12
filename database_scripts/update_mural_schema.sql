-- Add Mural columns to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS show_on_mural BOOLEAN DEFAULT false;

-- Create storage bucket for mural images if it doesn't exist (using existing 'documents' or creating 'mural')
-- Let's stick to 'documents' but organizing in a 'mural' folder is logical at app level.
-- Ensure public access for reading mural images
CREATE POLICY "Public Read Mural" ON storage.objects FOR SELECT USING ( bucket_id = 'documents' );
