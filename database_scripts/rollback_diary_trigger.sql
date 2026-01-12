-- ROLLBACK SCRIPT 
-- Purpose: Revert 'handle_new_diary_entry' to "Immediate Mode" (Sends WhatsApp immediately on save).
-- Usage: Run this script to undo changes related to "Scheduled/18h Rule".

CREATE OR REPLACE FUNCTION public.handle_new_diary_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_recipient_id UUID;
    v_student_name TEXT;
BEGIN
    -- 1. Get Student Name
    SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;
    
    -- 2. Find Recipient (Parent/Guardian)
    
    -- Priority 1: Check 'student_guardians' (The Robust Way)
    SELECT guardian_id INTO v_recipient_id
    FROM public.student_guardians
    WHERE student_id = NEW.student_id
    ORDER BY is_primary DESC, created_at DESC
    LIMIT 1;

    -- Priority 2: Fallback to 'students.parent_id' (Legacy Way)
    IF v_recipient_id IS NULL THEN
        SELECT parent_id INTO v_recipient_id FROM public.students WHERE id = NEW.student_id;
    END IF;

    -- If still no recipient, abort
    IF v_recipient_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 3. Insert Notification IMMEDIATELY
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        data
    ) VALUES (
        v_recipient_id,
        'diary',
        'Diário Escolar Atualizado 📝',
        'O diário de ' || v_student_name || ' foi atualizado. Confira as atividades e rotina de hoje no aplicativo.',
        jsonb_build_object(
            'student_id', NEW.student_id,
            'report_id', NEW.id,
            'date', NEW.date
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
