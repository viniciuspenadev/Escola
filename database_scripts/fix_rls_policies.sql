-- Fix RLS: Allow ADMIN and SECRETARY to manage app settings
-- This is necessary because the menu allows SECRETARY access, but the DB was blocking it.

-- 1. Drop old policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;

-- 2. Create comprehensive policy for ADMIN and SECRETARY
-- Allows SELECT, INSERT, UPDATE
CREATE POLICY "Staff can manage settings" ON public.app_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'SECRETARY')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'SECRETARY')
        )
    );

-- 3. Ensure RLS is enabled
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 4. Apply same logic to Logs if needed (View only)
DROP POLICY IF EXISTS "Admins can view logs" ON public.wpp_notification_logs;

CREATE POLICY "Staff can view logs" ON public.wpp_notification_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'SECRETARY')
        )
    );

-- 5. Force Service Role access (just in case default overrides are missing)
-- Supabase Service Role bypasses RLS by default, so this is usually not needed, 
-- but good to know: ensure your Edge Function uses service_role key.
