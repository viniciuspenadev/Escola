-- 1. Enhance Students Table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS rg TEXT,
ADD COLUMN IF NOT EXISTS birth_city TEXT,
ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS health_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS academic_history JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS financial_responsible JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. RPC Function to Approve Enrollment
-- This function does:
-- a) Creates a Student record from Enrollment data
-- b) Links the Enrollment to the Student
-- c) Updates Enrollment status to 'approved'
CREATE OR REPLACE FUNCTION public.approve_enrollment(enrollment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    enrollment_record RECORD;
    new_student_id UUID;
BEGIN
    -- 1. Get Enrollment
    SELECT * INTO enrollment_record FROM public.enrollments WHERE id = enrollment_id;
    
    IF enrollment_record IS NULL THEN
        RAISE EXCEPTION 'Enrollment not found';
    END IF;
    
    IF enrollment_record.status = 'approved' THEN
        RAISE EXCEPTION 'Enrollment already approved';
    END IF;

    -- 2. Create Student
    INSERT INTO public.students (
        name,
        birth_date,
        cpf,
        rg,
        address,
        health_info,
        documents,
        financial_responsible,
        status
    ) VALUES (
        enrollment_record.candidate_name,
        (enrollment_record.details->>'birth_date')::DATE,
        enrollment_record.details->>'student_cpf',
        enrollment_record.details->>'rg',
        jsonb_build_object(
            'zip_code', enrollment_record.details->>'zip_code',
            'street', enrollment_record.details->>'address',
            'number', enrollment_record.details->>'address_number',
            'neighbor', enrollment_record.details->>'neighbor',
            'city', enrollment_record.details->>'city',
            'state', enrollment_record.details->>'state',
            'complement', enrollment_record.details->>'complement'
        ),
        jsonb_build_object(
            'blood_type', enrollment_record.details->>'blood_type',
            'allergies', enrollment_record.details->>'allergies',
            'health_insurance', enrollment_record.details->>'health_insurance',
            'health_insurance_number', enrollment_record.details->>'health_insurance_number'
        ),
        coalesce(enrollment_record.details->'documents', '{}'::jsonb),
        jsonb_build_object(
            'name', enrollment_record.details->>'parent_name',
            'cpf', enrollment_record.details->>'parent_cpf',
            'email', enrollment_record.parent_email,
            'phone', enrollment_record.details->>'parent_phone'
        ),
        'active'
    ) RETURNING id INTO new_student_id;

    -- 3. Update Enrollment
    UPDATE public.enrollments 
    SET 
        status = 'approved',
        student_id = new_student_id,
        updated_at = NOW()
    WHERE id = enrollment_id;

    RETURN jsonb_build_object('success', true, 'student_id', new_student_id);
END;
$$;
