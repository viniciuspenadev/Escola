-- Migration: Link Grades to Enrollments
-- Objective: Add enrollment_id to student_grades and auto-populate it via Trigger.

-- 1. Add Column (Safe, nullable initially)
ALTER TABLE public.student_grades 
ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id);

-- 2. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.set_grade_enrollment_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Logic: Find the enrollment_id for this Student + Class combo
    SELECT ce.enrollment_id INTO NEW.enrollment_id
    FROM grade_books gb
    JOIN class_enrollments ce ON ce.class_id = gb.class_id AND ce.student_id = NEW.student_id
    WHERE gb.id = NEW.grade_book_id
    LIMIT 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the Trigger
DROP TRIGGER IF EXISTS trigger_set_grade_enrollment_id ON public.student_grades;
CREATE TRIGGER trigger_set_grade_enrollment_id
    BEFORE INSERT OR UPDATE ON public.student_grades
    FOR EACH ROW
    EXECUTE FUNCTION public.set_grade_enrollment_id();

-- 4. BACKFILL EXISTING DATA (The "Magic" Step)
-- This updates all existing grades to having the correct enrollment_id immediately.
UPDATE public.student_grades sg
SET enrollment_id = sub.enrollment_id
FROM (
    SELECT sg.id, ce.enrollment_id
    FROM student_grades sg
    JOIN grade_books gb ON gb.id = sg.grade_book_id
    JOIN class_enrollments ce ON ce.class_id = gb.class_id AND ce.student_id = sg.student_id
) sub
WHERE sg.id = sub.id AND sg.enrollment_id IS NULL;


-- ROLLBACK INSTRUCTIONS (Just in case)
-- -------------------------------------
-- DROP TRIGGER IF EXISTS trigger_set_grade_enrollment_id ON public.student_grades;
-- DROP FUNCTION IF EXISTS public.set_grade_enrollment_id();
-- ALTER TABLE public.student_grades DROP COLUMN IF EXISTS enrollment_id;
