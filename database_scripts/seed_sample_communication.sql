-- Seed a sample communication for testing
DO $$
DECLARE
    v_channel_id UUID;
    v_comm_id UUID;
    v_student_id UUID;
    v_guardian_id UUID;
BEGIN
    -- Get 'Diretoria' channel
    SELECT id INTO v_channel_id FROM public.communication_channels WHERE name = 'Diretoria' LIMIT 1;
    
    -- Get a student and guardian pair (adjust if needed, getting first one found)
    SELECT student_id, guardian_id INTO v_student_id, v_guardian_id 
    FROM public.student_guardians LIMIT 1;

    IF v_student_id IS NOT NULL AND v_channel_id IS NOT NULL THEN
        -- Insert Communication
        INSERT INTO public.communications (
            channel_id,
            sender_profile_id, -- Leaving null or use auth.uid() if running in context
            title,
            preview_text,
            content,
            priority,
            allow_reply
        ) VALUES (
            v_channel_id,
            NULL,
            'Volta às Aulas 2026! ❤️',
            'Estamos muito felizes em receber nossos alunos para mais um ano incrível!',
            '<p>Prezados Pais e Responsáveis,</p><p>É com muita alegria que iniciamos o ano letivo de 2026...</p>',
            1,
            true
        ) RETURNING id INTO v_comm_id;

        -- Insert Recipient
        INSERT INTO public.communication_recipients (
            communication_id,
            student_id,
            guardian_id
        ) VALUES (
            v_comm_id,
            v_student_id,
            v_guardian_id
        );
        
        RAISE NOTICE 'Seeded Communication ID: %', v_comm_id;
    END IF;
END $$;
