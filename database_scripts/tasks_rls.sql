-- Create tasks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    type TEXT NOT NULL DEFAULT 'manual',
    due_date TIMESTAMPTZ,
    created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Helper function to check role (assuming profile table or metadata, adjusting based on findings)
-- For now, using a generic check. If you store roles in public.profiles:
CREATE OR REPLACE FUNCTION public.is_admin_or_coordinator()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'COORDINATOR')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies

-- 1. VIEW (Select)
-- Admins/Coords see ALL. Others see only their own.
DROP POLICY IF EXISTS "Tasks visibility" ON public.tasks;
CREATE POLICY "Tasks visibility" ON public.tasks
FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'COORDINATOR')
  OR
  created_by = auth.uid()
);

-- 2. INSERT
-- Authenticated users can create tasks.
DROP POLICY IF EXISTS "Tasks creation" ON public.tasks;
CREATE POLICY "Tasks creation" ON public.tasks
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
);

-- 3. UPDATE
-- Admins/Coords update ALL. Others update their own.
DROP POLICY IF EXISTS "Tasks update" ON public.tasks;
CREATE POLICY "Tasks update" ON public.tasks
FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'COORDINATOR')
  OR
  created_by = auth.uid()
);

-- 4. DELETE
-- Admins/Coords delete ALL. Others delete their own.
DROP POLICY IF EXISTS "Tasks delete" ON public.tasks;
CREATE POLICY "Tasks delete" ON public.tasks
FOR DELETE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'COORDINATOR')
  OR
  created_by = auth.uid()
);
