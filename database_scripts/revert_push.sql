-- Revert Push Notification System (CORRECTED)
-- Retaining Internal Notifications (Bell Icon) functionality.

-- 1. Remove ONLY the Push Trigger (The one that calls the Edge Function)
-- We explicitly drop known trigger names and use CASCADE on the function to be safe.
DROP TRIGGER IF EXISTS on_notification_created ON notifications;
DROP TRIGGER IF EXISTS trigger_push_notification ON notifications;

DROP FUNCTION IF EXISTS public.trigger_push_notification() CASCADE;

-- 2. Remove Subscriptions Table (Cleanup)
DROP TABLE IF EXISTS public.notification_subscriptions;

-- 3. DO NOT REMOVE 'on_diary_created' or 'handle_new_diary_entry'
-- These are responsible for creating the internal notification (Bell Icon).
-- We want to keep these active!

-- 4. Clean up the Edge Function is done by file deletion (already done).
