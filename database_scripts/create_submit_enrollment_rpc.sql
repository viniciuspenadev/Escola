-- Function to handle public enrollment submission securely
-- This avoids the need for public SELECT permissions on the leads table

CREATE OR REPLACE FUNCTION public.submit_enrollment(
    p_parent_name TEXT,
    p_parent_email TEXT,
    p_parent_phone TEXT,
    p_children JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin)
SET search_path = public -- Secure search path
AS $$
DECLARE
    v_lead_id UUID;
    v_child JSONB;
BEGIN
    -- 1. Insert Lead
    INSERT INTO public.leads (name, email, phone, status, source)
    VALUES (p_parent_name, p_parent_email, p_parent_phone, 'new', 'lp')
    RETURNING id INTO v_lead_id;

    -- 2. Insert Children
    IF p_children IS NOT NULL AND jsonb_array_length(p_children) > 0 THEN
        FOR v_child IN SELECT * FROM jsonb_array_elements(p_children)
        LOOP
            INSERT INTO public.lead_children (
                lead_id,
                name,
                birth_date,
                intended_grade,
                previous_school
            ) VALUES (
                v_lead_id,
                (v_child->>'name')::TEXT,
                (v_child->>'birth_date')::DATE,
                (v_child->>'intended_grade')::TEXT,
                (v_child->>'previous_school')::TEXT
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to anon and authenticated
GRANT EXECUTE ON FUNCTION public.submit_enrollment TO anon, authenticated;
