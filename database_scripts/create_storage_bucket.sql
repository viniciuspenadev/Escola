
-- Enable Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT DO NOTHING;

-- Policy to allow authenticated users (Admins/Parents) to upload
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'documents' );
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'documents' AND auth.role() = 'authenticated' );
