-- Function to allow Admins to create new users directly
create extension if not exists pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id UUID;
    encrypted_pw TEXT;
BEGIN
    -- 1. Check Permissions (ensure only admins can run this)
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem criar usuários.';
    END IF;

    -- 2. Check if user exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Usuário já existe com este email.';
    END IF;

    -- 3. Create User in auth.users
    new_user_id := gen_random_uuid();
    encrypted_pw := crypt(p_password, gen_salt('bf'));

    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_current,
        email_change_token_new,
        email_change,
        reauthentication_token,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        p_email,
        encrypted_pw,
        now(),
        '', -- confirmation_token (prevent NULL scan error)
        '', -- recovery_token (prevent NULL scan error)
        '', -- email_change_token_current (prevent NULL scan error)
        '', -- email_change_token_new (prevent NULL scan error)
        '', -- email_change (prevent NULL scan error)
        '', -- reauthentication_token (prevent NULL scan error)
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object(
            'sub', new_user_id::text,
            'name', p_name,
            'role', p_role,
            'email', p_email,
            'email_verified', true,
            'phone_verified', false
        ), -- Complete metadata matching Supabase standards
        now(),
        now()
    );

    -- 3a. Create Identity (CRITICAL for login to work)
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        new_user_id,
        jsonb_build_object('sub', new_user_id, 'email', p_email, 'email_verified', true, 'phone_verified', false),
        'email',
        p_email,
        now(),
        now(),
        now()
    );

    -- 4. Create Profile (Trigger might do this, but safe to upsert)
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (new_user_id, p_email, p_name, p_role::user_role)
    ON CONFLICT (id) DO UPDATE
    SET role = p_role::user_role, name = p_name;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id
    );
END;
$$;
