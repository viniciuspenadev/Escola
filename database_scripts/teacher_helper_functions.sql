-- ============================================
-- FASE 2: FUNÇÕES HELPER PARA CONTROLE DE ACESSO
-- ============================================
-- Funções auxiliares para verificar permissões de professores
-- SEGURANÇA: Todas usam SECURITY DEFINER para evitar recursão RLS

-- ============================================
-- 1. Verifica se usuário atual é TEACHER
-- ============================================
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = 'TEACHER'
  );
$$;

-- Teste básico:
-- SELECT is_teacher(); -- Deve retornar true/false

-- ============================================
-- 2. Verifica se professor tem acesso a uma turma
-- ============================================
CREATE OR REPLACE FUNCTION public.teacher_has_class_access(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_teachers
    WHERE class_id = p_class_id 
    AND teacher_id = auth.uid()
  );
$$;

-- Teste básico:
-- SELECT teacher_has_class_access('algum-uuid-de-turma'); -- true se tiver acesso

-- ============================================
-- 3. Retorna IDs das turmas do professor
-- ============================================
CREATE OR REPLACE FUNCTION public.get_teacher_class_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(class_id)
  FROM public.class_teachers
  WHERE teacher_id = auth.uid();
$$;

-- Teste básico:
-- SELECT get_teacher_class_ids(); -- Retorna array de UUIDs ou NULL

-- ============================================
-- 4. Verifica se é COORDINATOR (para uso futuro)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_coordinator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = 'COORDINATOR'
  );
$$;

-- ============================================
-- 5. Verifica se é PARENT (para uso em políticas)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_parent()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = 'PARENT'
  );
$$;

-- ============================================
-- TESTES DE VALIDAÇÃO
-- ============================================

-- Teste 1: is_admin() ainda funciona (NÃO QUEBRAR!)
SELECT is_admin() as admin_check; 
-- Deve retornar true para ADMIN, false para outros

-- Teste 2: Nova função is_teacher()
SELECT is_teacher() as teacher_check;
-- Deve retornar true para TEACHER, false para outros

-- Teste 3: Todas as funções juntas (sanity check)
SELECT 
    is_admin() as is_admin,
    is_teacher() as is_teacher,
    is_coordinator() as is_coordinator,
    is_parent() as is_parent;
-- Apenas UMA deve ser true por usuário

-- ============================================
-- FIM DAS FUNÇÕES HELPER
-- ============================================
-- Próximo passo: Aplicar políticas RLS que usam essas funções
