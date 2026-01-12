-- ============================================
-- FASE 4: RPCs BACKEND PARA PROFESSORES
-- ============================================
-- Funções RPC para facilitar queries no frontend

-- ============================================
-- RPC 1: Lista turmas do professor autenticado
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_classes()
RETURNS TABLE (
    id UUID,
    name TEXT,
    grade_level TEXT,
    school_year TEXT,
    student_count BIGINT,
    subject TEXT,
    is_primary BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        c.id,
        c.name,
        c.grade_level,
        c.school_year,
        COUNT(DISTINCT ce.student_id) as student_count,
        ct.subject,
        ct.is_primary
    FROM classes c
    JOIN class_teachers ct ON c.id = ct.class_id
    LEFT JOIN class_enrollments ce ON c.id = ce.class_id
    WHERE ct.teacher_id = auth.uid()
    GROUP BY c.id, c.name, c.grade_level, c.school_year, ct.subject, ct.is_primary
    ORDER BY c.name;
$$;

-- ============================================
-- RPC 2: Lista alunos de uma turma específica
-- (com verificação de acesso)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_class_students(p_class_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    birth_date DATE,
    photo_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificação de acesso
    IF NOT (is_admin() OR teacher_has_class_access(p_class_id)) THEN
        RAISE EXCEPTION 'Acesso negado a esta turma';
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.birth_date,
        s.photo_url
    FROM students s
    JOIN class_enrollments ce ON s.id = ce.student_id
    WHERE ce.class_id = p_class_id
    ORDER BY s.name;
END;
$$;

-- ============================================
-- RPC 3: Estatísticas da turma (bonus)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_class_stats(p_class_id UUID)
RETURNS TABLE (
    total_students BIGINT,
    active_students BIGINT,
    last_attendance_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificação de acesso
    IF NOT (is_admin() OR teacher_has_class_access(p_class_id)) THEN
        RAISE EXCEPTION 'Acesso negado a esta turma';
    END IF;

    RETURN QUERY
    SELECT 
        COUNT(DISTINCT ce.student_id) as total_students,
        COUNT(DISTINCT CASE WHEN s.status = 'active' THEN ce.student_id END) as active_students,
        MAX(ca.date) as last_attendance_date
    FROM class_enrollments ce
    LEFT JOIN students s ON ce.student_id = s.id
    LEFT JOIN class_attendance_sheets ca ON ca.class_id = ce.class_id
    WHERE ce.class_id = p_class_id;
END;
$$;

-- ============================================
-- TESTES DAS RPCs
-- ============================================

-- Teste 1: get_my_classes() como TEACHER
-- SELECT * FROM get_my_classes();
-- Deve retornar apenas turmas do professor logado

-- Teste 2: get_class_students(class_id) como TEACHER
-- SELECT * FROM get_class_students('uuid-de-uma-turma-sua');
-- Deve retornar alunos da turma

-- Teste 3: Tentativa de acessar turma não-atribuída
-- SELECT * FROM get_class_students('uuid-de-turma-de-outro-professor');
-- Deve dar erro: "Acesso negado a esta turma"

-- Teste 4: Como ADMIN (deve funcionar para qualquer turma)
-- SELECT * FROM get_class_students('qualquer-uuid');
-- Deve funcionar normalmente
