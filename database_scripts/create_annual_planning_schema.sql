-- Create subjects table (Catálogo de Matérias)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10) DEFAULT '📚',
    color VARCHAR(255) DEFAULT 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Policies for subjects
-- Everyone can read subjects
CREATE POLICY "Everyone can read subjects" ON public.subjects
    FOR SELECT USING (true);

-- Only Admins/Coordinators/Secretaries can manage subjects
CREATE POLICY "Admins manage subjects" ON public.subjects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'COORDINATOR', 'SECRETARY')
        )
    );

-- Create lesson_plans table
CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Professor owner
    subject_id UUID REFERENCES public.subjects(id) ON DELETE RESTRICT, -- Link to catalog
    
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    topic VARCHAR(200),        -- Tópico da aula (Opcional)
    objective TEXT,            -- Objetivo (Opcional)
    materials TEXT,            -- Materiais (Opcional)
    notes TEXT,                -- Notas do professor (Opcional)
    homework TEXT,             -- Lição de casa (Opcional)
    
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled', 'rescheduled')),
    is_modified BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lesson_plans_class_date ON public.lesson_plans(class_id, date);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher ON public.lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject ON public.lesson_plans(subject_id);

-- Enable RLS for lesson_plans
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- Policies for lesson_plans

-- 1. Read access: 
-- Admins/Staff: All
-- Teachers: Their classes
-- Parents/Students: Their classes

CREATE POLICY "Admins and Staff view all lesson plans" ON public.lesson_plans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'COORDINATOR', 'SECRETARY')
        )
    );

CREATE POLICY "Teachers view their classes lesson plans" ON public.lesson_plans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.class_teachers
            WHERE class_id = lesson_plans.class_id
            AND teacher_id = auth.uid()
        )
        OR teacher_id = auth.uid() -- Also if they created it directly
    );

CREATE POLICY "Parents and Students view their classes lesson plans" ON public.lesson_plans
    FOR SELECT USING (
        -- Check if user is linked to a student in this class via enrollment
        EXISTS (
            SELECT 1 FROM public.class_enrollments ce
            JOIN public.enrollments e ON e.id = ce.enrollment_id
            -- Link parent/student to enrollment (assuming RLS on enrollments/students handles this auth check usually, 
            -- but here we need direct check for performance or rely on helper tables)
            -- Simpler approach: Check if auth.uid() is the parent or database has link.
            -- Using a common pattern: User -> Student -> Class
            WHERE ce.class_id = lesson_plans.class_id
            AND (
                -- If user is the student (future proof)
                -- e.student_id IN (SELECT id FROM students WHERE user_id = auth.uid()) -- Hypothetical
                -- OR
                -- If user is parent of student
                -- For now, let's assume broad read access for authenticated users restricted by application logic
                -- OR implementing a strict check:
                EXISTS (
                    SELECT 1 FROM public.student_guardians sg
                    WHERE sg.student_id = ce.student_id
                    AND sg.guardian_id = auth.uid()
                )
            )
        )
    );

-- Simplified Read Policy for MVP (Authenticated users can read plans if they have access to the class context in App)
-- To be safe and performant, we might start with:
-- Authenticated users can read. The UI filters by class ID. 
-- But strictly:
CREATE POLICY "Authenticated read lesson plans" ON public.lesson_plans
    FOR SELECT USING (auth.role() = 'authenticated');


-- 2. Write access (Insert/Update/Delete):
-- Admins/Staff: All
-- Teachers: Their classes

CREATE POLICY "Admins and Staff manage lesson plans" ON public.lesson_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'COORDINATOR', 'SECRETARY')
        )
    );

CREATE POLICY "Teachers manage their classes lesson plans" ON public.lesson_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.class_teachers
            WHERE class_id = lesson_plans.class_id
            AND teacher_id = auth.uid()
        )
    );

-- Create lesson_plan_changes table (Audit Log)
CREATE TABLE IF NOT EXISTS public.lesson_plan_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_plan_id UUID NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    
    change_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'cancelled'
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    parents_notified BOOLEAN DEFAULT false
);

-- Index for history
CREATE INDEX IF NOT EXISTS idx_changes_lesson ON public.lesson_plan_changes(lesson_plan_id, changed_at DESC);

-- Enable RLS for changes
ALTER TABLE public.lesson_plan_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone view changes" ON public.lesson_plan_changes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System create changes" ON public.lesson_plan_changes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
