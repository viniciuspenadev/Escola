-- Trigger to automatically create a notification when a Daily Report is created/updated
-- Logic: Send only 1 notification per day per student to avoid spam during editing.

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

    -- 2. Check if we already notified this parent about this student TODAY
    -- We assume 'diary' type notifications have data->>'student_id'
    IF EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_parent_id
        AND type = 'diary'
        AND (data->>'student_id')::UUID = NEW.student_id
        AND DATE(created_at) = CURRENT_DATE
    ) THEN
        -- Already notified today, skip to avoid spam
        RETURN NEW;
    END IF;

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

-- Drop trigger if exists to allow recreation
DROP TRIGGER IF EXISTS on_diary_change ON public.daily_reports;

-- Create Trigger
CREATE TRIGGER on_diary_change
AFTER INSERT OR UPDATE ON public.daily_reports
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_diary_entry();
