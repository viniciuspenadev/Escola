-- Classes Table
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_year INTEGER NOT NULL,
    shift TEXT CHECK (shift IN ('morning', 'afternoon', 'full', 'night')),
    capacity INTEGER DEFAULT 25,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link Students to Classes (The Roster)
CREATE TABLE IF NOT EXISTS public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE, -- The Data Integrity Link
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate students in the SAME class
    UNIQUE(class_id, student_id)
);

-- Link Teachers to Classes
CREATE TABLE IF NOT EXISTS public.class_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT, -- e.g. "Matemática" or NULL for Regente
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

-- Policies (Admins & Secretaries have full access)
CREATE POLICY "Admins full access classes" ON public.classes
FOR ALL USING (public.is_admin());

CREATE POLICY "Admins full access class_enrollments" ON public.class_enrollments
FOR ALL USING (public.is_admin());

CREATE POLICY "Admins full access class_teachers" ON public.class_teachers
FOR ALL USING (public.is_admin());

-- READ-ONLY for Teachers (They need to see classes they are assigned to)
-- We will refine this later. For now, Admins/Secretaries only.

-- Indexes for Performance
CREATE INDEX idx_classes_year ON public.classes(school_year);
CREATE INDEX idx_class_enrollments_student ON public.class_enrollments(student_id);
CREATE INDEX idx_class_enrollments_class ON public.class_enrollments(class_id);
