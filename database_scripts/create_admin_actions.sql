-- RPC to allow Admins to link a user to a student manually
-- Updated to handle profile creation race condition
CREATE OR REPLACE FUNCTION public.admin_add_guardian(
    p_student_id UUID,
    p_guardian_id UUID,
    p_relationship TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- 1. Check if Executing User is Admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem vincular responsáveis manualmente.';
    END IF;

    -- 2. Get the guardian's email from auth.users
    SELECT email INTO user_email FROM auth.users WHERE id = p_guardian_id;
    
    IF user_email IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado no sistema de autenticação.';
    END IF;

    -- 3. Ensure Profile Exists (Fix Race Condition)
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        p_guardian_id,
        user_email,
        'Responsável',
        'PARENT'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'PARENT',
        updated_at = NOW();

    -- 4. Create the Link
    INSERT INTO public.student_guardians (student_id, guardian_id, relationship, is_primary)
    VALUES (p_student_id, p_guardian_id, p_relationship, TRUE)
    ON CONFLICT (student_id, guardian_id) DO UPDATE
    SET is_primary = TRUE;

    RETURN jsonb_build_object('success', true);
END;
$$;
