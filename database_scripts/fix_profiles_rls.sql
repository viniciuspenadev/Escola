
-- 1. Enable RLS (just in case)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop potential conflicting policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- 3. CRITICAL: Allow users to read their OWN profile
-- Without this, the policy on 'enrollments' cannot check if you are an Admin!
CREATE POLICY "Users can read own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- 4. Allow Admins to read, update, etc.
CREATE POLICY "Admins full control" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (
    -- Direct check to avoid recursion if possible, or rely on the "read own" policy above
    auth.uid() = id 
    OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
