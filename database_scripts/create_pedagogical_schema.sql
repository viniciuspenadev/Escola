-- Pedagogical Module Schema

-- 1. Attendance (Frequência)
CREATE TABLE IF NOT EXISTS public.class_attendance_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    taken_by UUID, -- REFERENCES public.users(id) or profiles(id) depending on auth setup
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate sheets for the same class on the same day
    UNIQUE(class_id, date)
);

CREATE TABLE IF NOT EXISTS public.student_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID REFERENCES public.class_attendance_sheets(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES public.enrollments(id), -- Optional link for traceability
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'justified')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(sheet_id, student_id)
);

-- 2. Daily Agenda / Routine (Agenda Digital)
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Structured Data for Early Childhood (Alimentação, Sono, Higiene)
    -- Schema: { "meals": {...}, "sleep": {...}, "hygiene": {...}, "mood": "..." }
    routine_data JSONB DEFAULT '{}',
    
    -- Elementary School Fields
    homework TEXT,
    activities TEXT,
    observations TEXT, -- Private or Public notes
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(student_id, date)
);

-- 3. Grade Book (Boletim / Notas)
CREATE TABLE IF NOT EXISTS public.grade_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    term TEXT NOT NULL, -- '1_bimestre', '2_bimestre', etc.
    subject TEXT, -- 'matematica', 'portugues' (or null for generalist classes)
    title TEXT NOT NULL, -- 'Prova 1', 'Trabalho em Grupo'
    max_score NUMERIC(5,2) DEFAULT 10.0,
    weight INTEGER DEFAULT 1,
    date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_book_id UUID REFERENCES public.grade_books(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    score NUMERIC(5,2),
    feedback TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(grade_book_id, student_id)
);

-- RLS Policies
ALTER TABLE public.class_attendance_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

-- Simple Policies for MVP (Admin/Staff Access All)
-- In production, teachers would only see their classes.

CREATE POLICY "Staff full access attendance_sheets" ON public.class_attendance_sheets FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');
CREATE POLICY "Staff full access student_attendance" ON public.student_attendance FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');
CREATE POLICY "Staff full access daily_reports" ON public.daily_reports FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');
CREATE POLICY "Staff full access grade_books" ON public.grade_books FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');
CREATE POLICY "Staff full access student_grades" ON public.student_grades FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_attendance_class_date ON public.class_attendance_sheets(class_id, date);
CREATE INDEX idx_daily_reports_student_date ON public.daily_reports(student_id, date);
CREATE INDEX idx_grades_class ON public.grade_books(class_id);
