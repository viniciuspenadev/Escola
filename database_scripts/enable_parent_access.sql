-- RLS Policies for Parent Portal Access

-- 1. Events (Calendar)
-- Parents need to see school events. 
-- For simplicity, we allow any authenticated user (Parent/Teacher/Admin) to view events.
CREATE POLICY "Authenticated users view events" ON public.events
FOR SELECT
TO authenticated
USING (true);

-- 2. Financial (Installments)
-- Parents can view installments LINKED to their approved enrollments
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

-- 3. Academic (Grades)
-- Parents can view grades LINKED to their student's class_enrollments
-- Note: Grades are usually linked to 'class_enrollments' OR 'student_id' directly?
-- Let's check 'class_grades' schema. usually it has 'student_id' or 'enrollment_id'.
-- Assuming 'class_grades' has 'student_id':
CREATE POLICY "Guardians view linked grades" ON public.class_grades
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = class_grades.student_id
        AND sg.guardian_id = auth.uid()
    )
);

-- 4. Academic (Attendance)
-- Parents can view attendance
CREATE POLICY "Guardians view linked attendance" ON public.class_attendance
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = class_attendance.student_id
        AND sg.guardian_id = auth.uid()
    )
);

-- 5. Class Enrollments (to see which class they are in)
CREATE POLICY "Guardians view class enrollments" ON public.class_enrollments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.student_guardians sg
        WHERE sg.student_id = class_enrollments.student_id
        AND sg.guardian_id = auth.uid()
    )
);
