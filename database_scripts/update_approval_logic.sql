CREATE OR REPLACE FUNCTION public.approve_enrollment(enrollment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    enrollment_record RECORD;
    final_student_id UUID;
BEGIN
    -- 1. Get Enrollment
    SELECT * INTO enrollment_record FROM public.enrollments WHERE id = enrollment_id;
    
    IF enrollment_record IS NULL THEN
        RAISE EXCEPTION 'Enrollment not found';
    END IF;
    
    IF enrollment_record.status = 'approved' THEN
        RAISE EXCEPTION 'Enrollment already approved';
    END IF;

    -- 2. Check if it's a generic new enrollment or a renewal (linked to existing student)
    IF enrollment_record.student_id IS NOT NULL THEN
        -- UPDATE EXISTING STUDENT
        UPDATE public.students SET
            name = enrollment_record.candidate_name,
            birth_date = (enrollment_record.details->>'birth_date')::DATE,
            cpf = enrollment_record.details->>'student_cpf',
            rg = enrollment_record.details->>'rg',
            address = jsonb_build_object(
                'zip_code', enrollment_record.details->>'zip_code',
                'street', enrollment_record.details->>'address',
                'number', enrollment_record.details->>'address_number',
                'neighbor', enrollment_record.details->>'neighbor',
                'city', enrollment_record.details->>'city',
                'state', enrollment_record.details->>'state',
                'complement', enrollment_record.details->>'complement'
            ),
            health_info = jsonb_build_object(
                'blood_type', enrollment_record.details->>'blood_type',
                'allergies', enrollment_record.details->>'allergies',
                'health_insurance', enrollment_record.details->>'health_insurance',
                'health_insurance_number', enrollment_record.details->>'health_insurance_number'
            ),
            -- For documents, we merge or replace? Let's replace to ensure latest are valid.
            documents = coalesce(enrollment_record.details->'documents', '{}'::jsonb),
            financial_responsible = jsonb_build_object(
                'name', enrollment_record.details->>'parent_name',
                'cpf', enrollment_record.details->>'parent_cpf',
                'email', enrollment_record.parent_email,
                'phone', enrollment_record.details->>'parent_phone'
            ),
            updated_at = NOW()
        WHERE id = enrollment_record.student_id;
        
        final_student_id := enrollment_record.student_id;
    ELSE
        -- CREATE NEW STUDENT
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
        ) RETURNING id INTO final_student_id;
    END IF;

    -- 3. Update Enrollment Status
    UPDATE public.enrollments 
    SET 
        status = 'approved',
        student_id = final_student_id, -- Ensure it is linked
        updated_at = NOW()
    WHERE id = enrollment_id;

    RETURN jsonb_build_object('success', true, 'student_id', final_student_id);
END;
$$;
