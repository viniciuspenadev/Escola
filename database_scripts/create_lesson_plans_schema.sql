-- Create Class Lesson Plans Table
CREATE TABLE IF NOT EXISTS public.class_lesson_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id),
    date DATE NOT NULL,
    schedule_id UUID REFERENCES public.class_schedules(id) ON DELETE SET NULL,
    title TEXT,
    description TEXT,
    activities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_plans_class_date ON public.class_lesson_plans(class_id, date);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher ON public.class_lesson_plans(teacher_id);

-- Enable RLS
ALTER TABLE public.class_lesson_plans ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS POLICIES
-- -----------------------------------------------------------------------------

-- 1. ADMIN/SECRETARY/COORDINATOR: Full Access
CREATE POLICY "Admins have full access to lesson plans"
ON public.class_lesson_plans
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('ADMIN', 'SECRETARY', 'COORDINATOR')
    )
);

-- 2. TEACHERS: View Plans (Own Plans OR Plans for their Classes)
CREATE POLICY "Teachers can view plans for their classes"
ON public.class_lesson_plans
FOR SELECT
USING (
    auth.uid() = teacher_id -- Created by me
    OR
    EXISTS ( -- Or I teach in this class
        SELECT 1 FROM public.class_teachers ct
        WHERE ct.class_id = class_lesson_plans.class_id
        AND ct.teacher_id = auth.uid()
    )
    OR
    EXISTS ( -- Fallback for Admins (Redundant but safe)
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('ADMIN', 'SECRETARY', 'COORDINATOR')
    )
);

-- 3. TEACHERS: Maintain Plans (Insert/Update/Delete) for THEIR Classes
CREATE POLICY "Teachers can manage plans for their classes"
ON public.class_lesson_plans
FOR ALL
USING (
    -- Must be a teacher of the class to create/edit plans for it
    EXISTS (
        SELECT 1 FROM public.class_teachers ct
        WHERE ct.class_id = class_lesson_plans.class_id
        AND ct.teacher_id = auth.uid()
    )
    AND
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'TEACHER'
    )
);

-- 4. PARENTS: View Only
CREATE POLICY "Parents can view plans for their children's active classes"
ON public.class_lesson_plans
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.enrollments e
        join public.class_enrollments ce on ce.enrollment_id = e.id
        WHERE ce.class_id = class_lesson_plans.class_id
        AND e.student_id IN (
            SELECT student_id FROM public.student_guardians WHERE guardian_id = auth.uid()
        )
    )
    AND
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'PARENT'
    )
);
