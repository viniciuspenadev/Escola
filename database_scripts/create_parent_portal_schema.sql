-- SAFE ROLLBACK:
-- To undo this entire migration, run:
-- DROP TABLE IF EXISTS public.student_guardians;
-- DROP POLICY IF EXISTS "Parents view linked students" ON public.students;

-- 1. Junction Table: Links existing Profiles (Parents) to Students
-- This allows Many-to-Many (Mother and Father can both access same student)
CREATE TABLE IF NOT EXISTS public.student_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Relationships & Permissions
    relationship TEXT CHECK (relationship IN ('father', 'mother', 'grandparent', 'other', 'financial_responsible')),
    is_primary BOOLEAN DEFAULT FALSE,
    can_pickup BOOLEAN DEFAULT FALSE, -- Security: shown on "Carteirinha"
    is_financial_responsible BOOLEAN DEFAULT FALSE, -- Access to Boletos
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate links
    UNIQUE(student_id, guardian_id)
);

-- 2. Enable RLS
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

-- 3. Policies for student_guardians
-- Admins can manage all links
CREATE POLICY "Admins manage guardians" ON public.student_guardians
    FOR ALL
    USING (public.is_admin());

-- Parents can view their OWN links
CREATE POLICY "Guardians view own links" ON public.student_guardians
    FOR SELECT
    USING (auth.uid() = guardian_id);

-- 4. Policies for Students (The Critical Part)
-- "A user can view a student IF they are linked in student_guardians"
CREATE POLICY "Guardians view linked students" ON public.students
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.student_guardians sg
            WHERE sg.student_id = id
            AND sg.guardian_id = auth.uid()
        )
    );

-- 5. Policies for Enrollments (Boletim/Financeiro access)
-- "A user can view an enrollment IF it belongs to a student they guardians"
CREATE POLICY "Guardians view linked enrollments" ON public.enrollments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.student_guardians sg
            WHERE sg.student_id = student_id
            AND sg.guardian_id = auth.uid()
        )
    );

-- 6. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian ON public.student_guardians(guardian_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON public.student_guardians(student_id);

-- 7. Add 'invite_token_expiry' to enrollments if strictly needed for the secure flow
-- ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
