-- Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  user_email text := 'professor@escola.com';
  user_password text := '123456';
  user_name text := 'Professor Teste';
BEGIN
  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      user_email,
      crypt(user_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now()
    );

    -- Insert into public.profiles
    -- Note: Handle conflict if trigger created it already, but usually triggers match ID
    -- If your system has a trigger on auth.users -> public.profiles, update the role instead.
    
    -- Try to insert or update
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (new_user_id, user_email, user_name, 'TEACHER')
    ON CONFLICT (id) DO UPDATE
    SET role = 'TEACHER', name = user_name;
    
    RAISE NOTICE 'User created: % (Password: %)', user_email, user_password;
  ELSE
    RAISE NOTICE 'User already exists: %', user_email;
    -- Ensure role is TEACHER
    UPDATE public.profiles SET role = 'TEACHER' WHERE email = user_email;
  END IF;
END $$;
