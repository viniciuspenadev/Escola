-- DANGER: DROPS ALL TABLES AND TYPES FOR A CLEAN START
-- RUN THIS ONLY IF YOU WANT TO RESET EVERYTHING

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS on_profile_created_check_enrollment ON public.profiles;
DROP FUNCTION IF EXISTS public.process_enrollment_on_signup();
DROP FUNCTION IF EXISTS public.sync_pending_enrollments();

DROP TABLE IF EXISTS public.enrollment_applications CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.daily_logs CASCADE;
DROP TABLE IF EXISTS public.authorized_persons CASCADE;
DROP TABLE IF EXISTS public.student_documents CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS public.user_role;
DROP TYPE IF EXISTS public.enrollment_status;
DROP TYPE IF EXISTS public.document_status;
DROP TYPE IF EXISTS public.payment_status;
DROP TYPE IF EXISTS calendar_events;

-- Clean Storage (Optional - requires manual bucket deletion usually, but we can try)
-- delete from storage.buckets where id = 'documents';
