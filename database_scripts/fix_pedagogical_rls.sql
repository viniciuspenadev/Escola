-- FIX RLS POLICIES FOR PEDAGOGICAL DATA
-- Problem: Previous policies allowed any 'authenticated' user (including Parents) to view ALL records.
-- Solution: Restrict Parents to view only their own children's data.

-- ==============================================================================
-- 1. Helper Function: Is Staff?
-- ==============================================================================
-- We likely already rely on checking public.profiles role, but let's make it inline or use existing is_admin if restricted.
-- For Staff (Teacher/Sec/Admin), we assume they can access all for now (or improve later).
-- "Staff manage ..." policies will use the EXISTS check on profile.

-- ==============================================================================
-- 2. DAILY REPORTS (Diario)
-- ==============================================================================
DROP POLICY IF EXISTS "Staff full access daily_reports" ON public.daily_reports;

-- Policy: Staff can do everything (Select, Insert, Update, Delete)
CREATE POLICY "Staff manage daily_reports" ON public.daily_reports
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('ADMIN', 'SECRETARY', 'TEACHER')
    )
);

-- Policy: Guardians can SELECT records for their linked students
CREATE POLICY "Guardians view own students daily_reports" ON public.daily_reports
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = daily_reports.student_id
        AND sg.guardian_id = auth.uid()
    )
);


-- ==============================================================================
-- 3. STUDENT ATTENDANCE (Frequência)
-- ==============================================================================
DROP POLICY IF EXISTS "Staff full access student_attendance" ON public.student_attendance;

CREATE POLICY "Staff manage student_attendance" ON public.student_attendance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('ADMIN', 'SECRETARY', 'TEACHER')
    )
);

CREATE POLICY "Guardians view own students attendance" ON public.student_attendance
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = student_attendance.student_id
        AND sg.guardian_id = auth.uid()
    )
);


-- ==============================================================================
-- 4. STUDENT GRADES (Notas)
-- ==============================================================================
DROP POLICY IF EXISTS "Staff full access student_grades" ON public.student_grades;

CREATE POLICY "Staff manage student_grades" ON public.student_grades
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('ADMIN', 'SECRETARY', 'TEACHER')
    )
);

CREATE POLICY "Guardians view own students grades" ON public.student_grades
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = student_grades.student_id
        AND sg.guardian_id = auth.uid()
    )
);

-- ==============================================================================
-- 5. REFRESH CLASS ATTENDANCE SHEETS (Metadata)
-- ==============================================================================
-- Leaving permissive for now as it contains no PII (just date/class_id), 
-- and parents might need it for joins. But better to restrict write access.

DROP POLICY IF EXISTS "Staff full access attendance_sheets" ON public.class_attendance_sheets;

CREATE POLICY "Staff manage attendance_sheets" ON public.class_attendance_sheets
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('ADMIN', 'SECRETARY', 'TEACHER')
    )
);

CREATE POLICY "Guardians view attendance_sheets" ON public.class_attendance_sheets
FOR SELECT
TO authenticated
USING (true); -- Public metadata (Date/Class) is low risk, simplest for joins.


-- ==============================================================================
-- 6. REFRESH GRADE BOOKS (Metadata: 'Mathematics Test 1')
-- ==============================================================================
DROP POLICY IF EXISTS "Staff full access grade_books" ON public.grade_books;

CREATE POLICY "Staff manage grade_books" ON public.grade_books
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('ADMIN', 'SECRETARY', 'TEACHER')
    )
);

CREATE POLICY "Guardians view grade_books" ON public.grade_books
FOR SELECT
TO authenticated
USING (true); -- Public metadata is low risk.
