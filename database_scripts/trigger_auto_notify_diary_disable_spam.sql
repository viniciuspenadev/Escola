-- Trigger to automatically create a notification when a Daily Report is created/updated
-- Logic: Anti-spam disabled for testing purposes.

CREATE OR REPLACE FUNCTION public.handle_new_diary_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_id UUID;
    v_student_name TEXT;
BEGIN
    -- 1. Get Student Info (Parent ID and Name)
    SELECT parent_id, name INTO v_parent_id, v_student_name
    FROM public.students
    WHERE id = NEW.student_id;

    -- If no parent linked, do nothing
    IF v_parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Anti-Spam Check (DISABLED FOR TESTING)
    -- IF EXISTS (
    --     SELECT 1 FROM public.notifications
    --     WHERE user_id = v_parent_id
    --     AND type = 'diary'
    --     AND (data->>'student_id')::UUID = NEW.student_id
    --     AND DATE(created_at) = CURRENT_DATE
    -- ) THEN
    --     RETURN NEW;
    -- END IF;

    -- 3. Insert Notification
    -- This will trigger the Webhook -> Edge Function -> WhatsApp
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        data
    ) VALUES (
        v_parent_id,
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
