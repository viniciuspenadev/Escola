-- Revert Lesson Plans Feature
-- Drop table (Rules/Indexes/Triggers are dropped primarily by CASCADE)
DROP TABLE IF EXISTS public.class_lesson_plans CASCADE;
