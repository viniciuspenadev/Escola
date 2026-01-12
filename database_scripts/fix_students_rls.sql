-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Allow Admins to do everything
CREATE POLICY "Admins can do everything on students"
ON public.students
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Allow implicit viewing if needed (e.g. for lists), but typically strict
-- If we want standard users to see something, add specific policies. 
-- For now, Admin Only + maybe read-only for public if requested? No, strict privacy.

-- Grant access to authenticated users to READ if they are the student?
-- (Not implemented yet, as authentication is via Admin login mostly)
