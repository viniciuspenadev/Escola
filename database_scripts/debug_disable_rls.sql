-- DEBUG: Temporarily disable RLS checks to verify connectivity
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;

-- Or if you prefer to keep RLS on but permissive:
-- DROP POLICY IF EXISTS "Debug Policy" ON public.app_settings;
-- CREATE POLICY "Debug Policy" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
