-- 1. Fix the Trigger Function to be "Idempotent" (Safe)
-- This prevents it from crashing if we already created the profile manually
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'PARENT')
  )
  ON CONFLICT (id) DO NOTHING; -- <--- CRITICAL FIX: Don't crash if exists
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure Trigger is Active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Cleanup "Bad" Users (Optional - Run manually if needed, but safe here)
-- This tries to fix any profiles that might be missing for existing users
INSERT INTO public.profiles (id, email, name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
    COALESCE((raw_user_meta_data->>'role')::public.user_role, 'PARENT')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT DO NOTHING;
