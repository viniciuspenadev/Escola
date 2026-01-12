-- SAFE ROLLBACK:
-- DROP TABLE IF EXISTS public.parent_invites;
-- DROP FUNCTION IF EXISTS public.generate_invite_token;
-- DROP FUNCTION IF EXISTS public.claim_invite;

-- 1. Invites Table
-- Stores temporary tokens to onboard parents
CREATE TABLE IF NOT EXISTS public.parent_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    token UUID DEFAULT gen_random_uuid() UNIQUE,
    relationship TEXT NOT NULL, -- 'father', 'mother', etc.
    parent_name TEXT, -- Optional, to pre-fill
    parent_phone TEXT, -- Optional, for record
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;

-- Admins can create/view invites
CREATE POLICY "Admins manage invites" ON public.parent_invites
    FOR ALL USING (public.is_admin());

-- Public can read invite (to validate token on landing page) via RPC mostly, but we might need SELECT access for specific token
-- Better to keep table private and access via RPC `get_invite_info` for security.

-- 2. RPC: Get Invite Info (Public)
-- Used by the frontend to show "Welcome Parents of [Student Name]"
CREATE OR REPLACE FUNCTION public.get_invite_info(invite_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to read invite data securely
AS $$
DECLARE
    invite_record RECORD;
    student_name TEXT;
BEGIN
    -- Check validity
    SELECT * INTO invite_record FROM public.parent_invites 
    WHERE token = invite_token AND used_at IS NULL AND expires_at > NOW();
    
    IF invite_record IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Convite inválido ou expirado');
    END IF;

    -- Get Student Name
    SELECT name INTO student_name FROM public.students WHERE id = invite_record.student_id;

    RETURN jsonb_build_object(
        'valid', true,
        'student_name', student_name,
        'relationship', invite_record.relationship,
        'parent_name', invite_record.parent_name
    );
END;
$$;

-- 3. RPC: Claim Invite (Authenticated User)
-- Called AFTER the user has signed up/logged in. Links them to the student.
CREATE OR REPLACE FUNCTION public.claim_invite(invite_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invite_record RECORD;
    new_guardian_id UUID;
    user_email TEXT;
BEGIN
    new_guardian_id := auth.uid(); -- The currently logged in user
    
    -- 0. Ensure Auth
    IF new_guardian_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado. Faça login para aceitar o convite.';
    END IF;

    -- Get email for profile creation if needed
    SELECT email INTO user_email FROM auth.users WHERE id = new_guardian_id;

    -- 1. Validate Invite
    SELECT * INTO invite_record FROM public.parent_invites 
    WHERE token = invite_token AND used_at IS NULL AND expires_at > NOW();

    IF invite_record IS NULL THEN
        RAISE EXCEPTION 'Convite inválido ou expirado';
    END IF;

    -- 1.5 Ensure Profile Exists (Fix Race Condition)
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        new_guardian_id, 
        user_email, 
        COALESCE(invite_record.parent_name, 'Responsável'), 
        'PARENT'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'PARENT', -- Ensure role is set
        updated_at = NOW();

    -- 2. Create the Link (Student <-> Guardian)
    INSERT INTO public.student_guardians (student_id, guardian_id, relationship, is_primary)
    VALUES (invite_record.student_id, new_guardian_id, invite_record.relationship, TRUE)
    ON CONFLICT (student_id, guardian_id) DO NOTHING;

    -- 3. Mark Invite Used
    UPDATE public.parent_invites
    SET used_at = NOW()
    WHERE id = invite_record.id;

    RETURN jsonb_build_object('success', true);
END;
$$;
