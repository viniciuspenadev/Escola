-- Migration: Remove Legacy parent_id from Students table
-- Description: Migrates existing parent_id links to student_guardians table and drops the column.

BEGIN;

-- 1. Migrate existing links to student_guardians
-- Only insert if the link doesn't already exist to avoid duplicates
INSERT INTO public.student_guardians (student_id, guardian_id, relationship, is_primary)
SELECT 
    s.id, 
    s.parent_id, 
    'financial_responsible', -- Default relationship for legacy migration
    TRUE -- Assume primary for these migrated legacy links
FROM 
    public.students s
WHERE 
    s.parent_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 
        FROM public.student_guardians sg 
        WHERE sg.student_id = s.id 
        AND sg.guardian_id = s.parent_id
    );

-- 2. Drop Dependent Policy
-- The policy "View class schedules" referenced students.parent_id
DROP POLICY IF EXISTS "View class schedules" ON public.class_schedules;

-- 3. Drop the Foreign Key Constraint
ALTER TABLE public.students 
DROP CONSTRAINT IF EXISTS students_parent_id_fkey;

-- 4. Drop the Column
ALTER TABLE public.students 
DROP COLUMN IF EXISTS parent_id;

-- 5. Recreate Policy (Cleaned up)
-- Removed the OR referencing s.parent_id
CREATE POLICY "View class schedules" ON public.class_schedules
FOR SELECT
USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'ADMIN'::user_role
    OR 
    (EXISTS (
        SELECT 1 FROM class_teachers ct
        WHERE ct.class_id = class_schedules.class_id AND ct.teacher_id = auth.uid()
    ))
    OR 
    (EXISTS (
        SELECT 1 FROM class_enrollments ce
        JOIN student_guardians sg ON sg.student_id = ce.student_id
        WHERE ce.class_id = class_schedules.class_id AND sg.guardian_id = auth.uid()
    ))
);

COMMIT;
