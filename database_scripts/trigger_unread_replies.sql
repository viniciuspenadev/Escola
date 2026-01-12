-- Trigger: Reset 'read_at' for recipients when an ADMIN reply is sent.
-- This effectively "bumps" the conversation as Unread for the parent.

CREATE OR REPLACE FUNCTION public.handle_new_admin_reply()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if it is an admin reply (sender is staff/admin)
    IF NEW.is_admin_reply = true THEN
        UPDATE public.communication_recipients
        SET read_at = NULL,
            updated_at = NOW()
        WHERE communication_id = NEW.communication_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow idempotent runs
DROP TRIGGER IF EXISTS trigger_on_admin_reply ON public.communication_replies;

CREATE TRIGGER trigger_on_admin_reply
AFTER INSERT ON public.communication_replies
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_admin_reply();
