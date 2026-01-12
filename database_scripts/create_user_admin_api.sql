-- SIMPLIFIED Admin User Creation using Supabase Auth Admin API
-- This approach is MORE RELIABLE than manual SQL insertion

-- Note: This function now just creates the PROFILE
-- The actual user creation should be done via Supabase Admin API in the frontend
-- Because trying to manually replicate all auth.users fields is error-prone

CREATE OR REPLACE FUNCTION public.admin_create_user_simple(
    p_user_id UUID,
    p_email TEXT,
    p_name TEXT,
    p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Check Permissions
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem criar usuários.';
    END IF;

    -- 2. Create or Update Profile (User already created via Admin API)
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (p_user_id, p_email, p_name, p_role::user_role)
    ON CONFLICT (id) DO UPDATE
    SET role = p_role::user_role, name = p_name, email = p_email;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id
    );
END;
$$;
