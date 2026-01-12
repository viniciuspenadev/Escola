-- ============================================
-- FASE 2.1: ADICIONAR POLÍTICA RLS EM class_teachers
-- ============================================
-- Permite que professores vejam suas próprias atribuições

-- Política SELECT para professores
-- IMPORTANTE: ADMIN já tem full access, não conflitar!

DROP POLICY IF EXISTS "Teachers view own assignments" ON public.class_teachers;

CREATE POLICY "Teachers view own assignments"
ON public.class_teachers
FOR SELECT
TO authenticated
USING (
    is_admin() OR -- ← ADMIN sempre primeiro!
    teacher_id = auth.uid() -- Professor vê apenas suas atribuições
);

-- Testar essa política:
-- Como ADMIN: SELECT * FROM class_teachers; (deve ver TODAS)
-- Como TEACHER: SELECT * FROM class_teachers; (deve ver apenas suas linhas)

-- ============================================
-- PRÓXIMO PASSO: Aplicar funções helper no restante
-- ============================================
