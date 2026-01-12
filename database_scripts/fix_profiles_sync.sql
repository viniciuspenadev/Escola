
-- 1. Sync existings users from auth.users to public.profiles
INSERT INTO public.profiles (id, email, name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'name', 'Usuário'), 
    COALESCE((raw_user_meta_data->>'role')::text::public.user_role, 'PARENT')
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- 2. IMPORTANT: Manually promote your user to ADMIN
-- Replace 'seu@email.com' with your login email
UPDATE public.profiles 
SET role = 'ADMIN' 
WHERE email = 'seu@email.com'; -- <--- EDITE AQUI SEU EMAIL

-- 3. Check the results
SELECT * FROM public.profiles;
