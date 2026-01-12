
-- 1. Create a secure function to check if user is Admin
-- "SECURITY DEFINER" runs with superuser privileges, bypassing the RLS recursion trap
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public -- Security best practice
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SECRETARY')
  );
$$;

-- 2. Clean up old recursive policies
DROP POLICY IF EXISTS "Admins full control" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles access" ON public.profiles; -- Add this to handle re-runs
DROP POLICY IF EXISTS "Admins full access" ON public.enrollments;

-- 3. New Profiles Policy (Clean & Fast)
-- Access if: It's YOUR profile OR You are an Admin (checked via safe function)
CREATE POLICY "Profiles access"
ON public.profiles
FOR ALL
TO authenticated
USING (
  id = auth.uid() 
  OR 
  public.is_admin()
);

-- 4. New Enrollments Policy (Clean)
CREATE POLICY "Admins full access"
ON public.enrollments
FOR ALL
TO authenticated
USING (
  public.is_admin()
);

-- Note: The Public Wizard policies (ANON) remain untouched and valid.
