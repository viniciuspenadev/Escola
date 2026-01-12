-- COMPREHENSIVE PARENT ACCESS FIX
-- This script ensures Guardians can view the entire chain of data:
-- Students -> Class Enrollments -> Classes -> Grade Books -> Student Grades

-- 1. CLASSES (Allow viewing classes where their student is enrolled)
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardians view enrolled classes" ON public.classes;

CREATE POLICY "Guardians view enrolled classes" ON public.classes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.class_enrollments ce
    JOIN public.student_guardians sg ON sg.student_id = ce.student_id
    WHERE ce.class_id = classes.id
    AND sg.guardian_id = auth.uid()
  )
);

-- 2. CLASS ENROLLMENTS (Allow viewing enrollments of their linked students)
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardians view class enrollments" ON public.class_enrollments;

CREATE POLICY "Guardians view class enrollments" ON public.class_enrollments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.student_guardians sg
    WHERE sg.student_id = class_enrollments.student_id
    AND sg.guardian_id = auth.uid()
  )
);

-- 3. GRADE BOOKS (Assessments/Pautas)
-- Allow viewing assessments for classes where their student is enrolled
ALTER TABLE public.grade_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardians view grade books" ON public.grade_books;
DROP POLICY IF EXISTS "Guardians can view grade books for their students classes" ON public.grade_books; -- Drop older name if exists

CREATE POLICY "Guardians view grade books" ON public.grade_books
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.class_enrollments ce
    JOIN public.student_guardians sg ON sg.student_id = ce.student_id
    WHERE ce.class_id = grade_books.class_id
    AND sg.guardian_id = auth.uid()
  )
);

-- 4. STUDENT GRADES (Scores/Notas)
-- Allow viewing specific grades belonging to their linked students
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardians view student grades" ON public.student_grades;
DROP POLICY IF EXISTS "Guardians can view grades for their students" ON public.student_grades;

CREATE POLICY "Guardians view student grades" ON public.student_grades
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.student_guardians sg
    WHERE sg.student_id = student_grades.student_id
    AND sg.guardian_id = auth.uid()
  )
);
