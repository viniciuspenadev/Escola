-- RPC to allow public/anon to create notifications for admins safely
CREATE OR REPLACE FUNCTION create_admin_notification(
    p_title TEXT,
    p_message TEXT,
    p_link TEXT,
    p_enrollment_id UUID
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (title, message, type, link, enrollment_id)
    VALUES (p_title, p_message, 'action_required', p_link, p_enrollment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
