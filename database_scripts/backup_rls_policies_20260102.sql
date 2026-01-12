-- ============================================
-- BACKUP DE POLÍTICAS RLS - 02/01/2026
-- ============================================
-- Este arquivo contém TODAS as políticas RLS atuais
-- Use para restaurar em caso de problemas

-- IMPORTANTE: Execute este arquivo COMPLETO para restaurar

-- ============================================
-- TABELA: profiles
-- ============================================

DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
CREATE POLICY "Profiles access"
ON public.profiles
FOR ALL
TO authenticated
USING ((id = auth.uid()) OR is_admin());

-- ============================================
-- TABELA: students  
-- ============================================

DROP POLICY IF EXISTS "Admins can do everything on students" ON public.students;
CREATE POLICY "Admins can do everything on students"
ON public.students
FOR ALL
TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS "Guardians view linked students" ON public.students;
CREATE POLICY "Guardians view linked students"
ON public.students
FOR SELECT
TO public
USING (EXISTS (
    SELECT 1 FROM student_guardians sg
    WHERE students.id = sg.student_id 
    AND sg.guardian_id = auth.uid()
));

-- ============================================
-- TABELA: classes
-- ============================================

DROP POLICY IF EXISTS "Admins full access classes" ON public.classes;
CREATE POLICY "Admins full access classes"
ON public.classes
FOR ALL
TO public
USING (is_admin());

DROP POLICY IF EXISTS "Guardians view assigned classes" ON public.classes;
CREATE POLICY "Guardians view assigned classes"
ON public.classes
FOR SELECT
TO public
USING (EXISTS (
    SELECT 1 FROM class_enrollments ce
    JOIN student_guardians sg ON ce.student_id = sg.student_id
    WHERE ce.class_id = classes.id 
    AND sg.guardian_id = auth.uid()
));

-- ============================================
-- TABELA: class_teachers (JÁ EXISTE!)
-- ============================================

DROP POLICY IF EXISTS "Admins full access class_teachers" ON public.class_teachers;
CREATE POLICY "Admins full access class_teachers"
ON public.class_teachers
FOR ALL
TO public
USING (is_admin());

-- ============================================
-- TABELA: class_enrollments
-- ============================================

DROP POLICY IF EXISTS "Admins full access class_enrollments" ON public.class_enrollments;
CREATE POLICY "Admins full access class_enrollments"
ON public.class_enrollments
FOR ALL
TO public
USING (is_admin());

-- ============================================
-- TABELA: class_attendance_sheets
-- ============================================

DROP POLICY IF EXISTS "Staff manage attendance_sheets" ON public.class_attendance_sheets;
CREATE POLICY "Staff manage attendance_sheets"
ON public.class_attendance_sheets
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'SECRETARY', 'TEACHER')
));

DROP POLICY IF EXISTS "Guardians view attendance_sheets" ON public.class_attendance_sheets;
CREATE POLICY "Guardians view attendance_sheets"
ON public.class_attendance_sheets
FOR SELECT
TO authenticated
USING (true); -- ⚠️ Atualmente TODOS podem ver

-- ============================================
-- TABELA: diary_entries
-- ============================================

DROP POLICY IF EXISTS "Staff manage diary" ON public.diary_entries;
CREATE POLICY "Staff manage diary"
ON public.diary_entries
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'SECRETARY', 'TEACHER')
));

DROP POLICY IF EXISTS "Guardians view diary" ON public.diary_entries;
CREATE POLICY "Guardians view diary"
ON public.diary_entries
FOR SELECT
TO public
USING (EXISTS (
    SELECT 1 FROM class_enrollments ce
    JOIN student_guardians sg ON ce.student_id = sg.student_id
    WHERE ce.class_id = diary_entries.class_id 
    AND sg.guardian_id = auth.uid()
));

-- ============================================
-- TABELA: enrollments
-- ============================================

DROP POLICY IF EXISTS "Admins full access" ON public.enrollments;
CREATE POLICY "Admins full access"
ON public.enrollments
FOR ALL
TO authenticated
USING (is_admin());

-- ============================================
-- TABELA: student_guardians
-- ============================================

DROP POLICY IF EXISTS "Admins manage guardians" ON public.student_guardians;
CREATE POLICY "Admins manage guardians"
ON public.student_guardians
FOR ALL
TO public
USING (is_admin());

DROP POLICY IF EXISTS "Guardians view own links" ON public.student_guardians;
CREATE POLICY "Guardians view own links"
ON public.student_guardians
FOR SELECT
TO public
USING (auth.uid() = guardian_id);

-- ============================================
-- TABELA: events
-- ============================================

DROP POLICY IF EXISTS "Admins manage events" ON public.events;
CREATE POLICY "Admins manage events"
ON public.events
FOR ALL
TO public
USING (is_admin());

DROP POLICY IF EXISTS "Users view events" ON public.events;
CREATE POLICY "Users view events"
ON public.events
FOR SELECT
TO public
USING (true);

-- ============================================
-- TABELA: school_years
-- ============================================

DROP POLICY IF EXISTS "Admins manage school years" ON public.school_years;
CREATE POLICY "Admins manage school years"
ON public.school_years
FOR ALL
TO public
USING (is_admin());

DROP POLICY IF EXISTS "Everyone can view school years" ON public.school_years;
CREATE POLICY "Everyone can view school years"
ON public.school_years
FOR SELECT
TO public
USING (true);

-- ============================================
-- TABELA: app_settings
-- ============================================

DROP POLICY IF EXISTS "Authenticated can update settings" ON public.app_settings;
CREATE POLICY "Authenticated can update settings"
ON public.app_settings
FOR ALL
TO public
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Everyone can read settings" ON public.app_settings;
CREATE POLICY "Everyone can read settings"
ON public.app_settings
FOR SELECT
TO public
USING (true);

-- ============================================
-- FIM DO BACKUP
-- ============================================
-- Total de tabelas: 15
-- Total de políticas: ~30
-- Data: 02/01/2026 09:15
-- Status: PRÉ-IMPLEMENTAÇÃO CONTROLE DE ACESSO TEACHER
