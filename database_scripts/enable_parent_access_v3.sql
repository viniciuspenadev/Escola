-- RLS Policies for Parent Portal Access (Corrected Relationships)

-- 1. Events (Calendar)
CREATE POLICY "Authenticated users view events" ON public.events
FOR SELECT
TO authenticated
USING (true);

-- 2. Financial (Installments)
-- Linked via Enrollment -> Student -> Guardian
CREATE POLICY "Guardians view linked installments" ON public.installments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.enrollments e
        JOIN public.student_guardians sg ON sg.student_id = e.student_id
        WHERE e.id = installments.enrollment_id
        AND sg.guardian_id = auth.uid()
    )
);

-- 3. Student Grades
-- Linked via Student -> Guardian
CREATE POLICY "Guardians view linked student_grades" ON public.student_grades
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = student_grades.student_id
        AND sg.guardian_id = auth.uid()
    )
);

-- 4. Grade Books
-- Linked via Class -> ClassEnrollment -> Student -> Guardian
CREATE POLICY "Guardians view relevant grade_books" ON public.grade_books
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.class_enrollments ce
        JOIN public.student_guardians sg ON sg.student_id = ce.student_id
        WHERE ce.class_id = grade_books.class_id
        AND sg.guardian_id = auth.uid()
    )
);

-- 5. Student Attendance
-- Linked via Student -> Guardian
CREATE POLICY "Guardians view linked student_attendance" ON public.student_attendance
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = student_attendance.student_id
        AND sg.guardian_id = auth.uid()
    )
);

-- 6. Daily Reports
-- Linked via Student -> Guardian
CREATE POLICY "Guardians view linked daily_reports" ON public.daily_reports
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = daily_reports.student_id
        AND sg.guardian_id = auth.uid()
    )
);

-- 7. Classes (Parents need to see class name)
-- Linked via ClassEnrollment -> Student -> Guardian
CREATE POLICY "Guardians view linked classes" ON public.classes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.class_enrollments ce
        JOIN public.student_guardians sg ON sg.student_id = ce.student_id
        WHERE ce.class_id = classes.id
        AND sg.guardian_id = auth.uid()
    )
);
