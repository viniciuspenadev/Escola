-- 1. Create Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    type TEXT DEFAULT 'generic', -- academic, holiday, meeting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID -- link to user if Auth enabled purely
);

-- 2. Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. Policies (Simple for now: authenticated users read/write)
-- In a real app, maybe only admins write. Assuming Admin-only app for now.
CREATE POLICY "Admins can do everything on events"
ON public.events
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
