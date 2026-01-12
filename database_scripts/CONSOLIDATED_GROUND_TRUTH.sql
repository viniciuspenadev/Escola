-- consolidated_schema.sql
-- Esse arquivo reconstrói toda a estrutura (schema) do Banco de Dados EscolaV2.
-- Gerado em: 2026-01-12

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron" SCHEMA "pg_catalog";

-- 2. ENUMS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'SECRETARY', 'TEACHER', 'PARENT', 'COORDINATOR');
    END IF;
END $$;

-- 3. TABLES

-- App Settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);

-- Profiles (Auth matching)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    name text,
    role user_role DEFAULT 'PARENT'::user_role,
    created_at timestamp with time zone DEFAULT now()
);

-- School Years
CREATE TABLE IF NOT EXISTS public.school_years (
    year integer PRIMARY KEY,
    status text DEFAULT 'planning' CHECK (status IN ('active', 'planning', 'finished')),
    created_at timestamp with time zone DEFAULT now()
);

-- Classes
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    school_year integer REFERENCES public.school_years(year),
    grade_level text, -- 'maternal', 'infantil_1', etc
    created_at timestamp with time zone DEFAULT now()
);

-- Students
CREATE TABLE IF NOT EXISTS public.students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    birth_date date,
    cpf text UNIQUE,
    rg text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'enrolled', 'graduated')),
    address jsonb,
    health_info jsonb,
    financial_responsible jsonb,
    academic_year integer REFERENCES public.school_years(year),
    created_at timestamp with time zone DEFAULT now()
);

-- Student-Guardian Relationship
CREATE TABLE IF NOT EXISTS public.student_guardians (
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship text, -- 'pai', 'mae', 'outro'
    is_primary boolean DEFAULT false,
    PRIMARY KEY (student_id, guardian_id)
);

-- Class Teachers
CREATE TABLE IF NOT EXISTS public.class_teachers (
    class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_main_teacher boolean DEFAULT true,
    PRIMARY KEY (class_id, teacher_id)
);

-- Enrollments (Processo de Matrícula)
CREATE TABLE IF NOT EXISTS public.enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id),
    candidate_name text NOT NULL,
    parent_email text NOT NULL,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'completed')),
    academic_year integer REFERENCES public.school_years(year),
    details jsonb, -- All extra form data
    invite_token text UNIQUE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Installments (Mensalidades)
CREATE TABLE IF NOT EXISTS public.installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE CASCADE,
    installment_number integer NOT NULL,
    value numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at timestamp with time zone,
    payment_method text,
    gateway_integration_id text,
    billing_url text,
    is_published boolean DEFAULT false,
    metadata jsonb,
    discount_value numeric(10,2) DEFAULT 0,
    surcharge_value numeric(10,2) DEFAULT 0,
    original_value numeric(10,2),
    negotiation_date timestamp with time zone,
    negotiation_notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- Class Enrollments (Alunos nas turmas)
CREATE TABLE IF NOT EXISTS public.class_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    enrolled_at timestamp with time zone DEFAULT now(),
    UNIQUE(class_id, student_id)
);

-- Lead Tracking (CRM)
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_name text NOT NULL,
    parent_phone text,
    parent_email text,
    status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'visited', 'negotiation', 'converted', 'lost')),
    source text, -- 'whatsapp', 'instagram', 'website', etc
    assigned_to uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_children (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    name text NOT NULL,
    birth_date date,
    intended_grade text,
    previous_school text,
    created_at timestamp with time zone DEFAULT now()
);

-- Mural / Announcements
CREATE TABLE IF NOT EXISTS public.mural_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    image_url text,
    type text DEFAULT 'general', -- 'academic', 'event', 'holiday'
    is_priority boolean DEFAULT false,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id)
);

-- 4. VIEWS

CREATE OR REPLACE VIEW public.student_management_overview AS
 WITH current_classes AS (
         SELECT ce.student_id,
            c.name AS class_name,
            c.id AS class_id
           FROM (class_enrollments ce
             JOIN classes c ON ((ce.class_id = c.id)))
          ORDER BY ce.created_at DESC
        ), attendance_stats AS (
         SELECT student_attendance.student_id,
            count(*) AS total_days,
            count(*) FILTER (WHERE (student_attendance.status = 'present'::text)) AS present_days,
            count(*) FILTER (WHERE (student_attendance.status = 'absent'::text)) AS absent_days
           FROM student_attendance
          GROUP BY student_attendance.student_id
        ), financial_stats AS (
         SELECT s_1.id AS student_id,
            count(i.id) FILTER (WHERE (i.status = 'overdue'::text)) AS overdue_count,
            count(i.id) FILTER (WHERE (i.status = 'pending'::text)) AS pending_count
           FROM ((students s_1
             LEFT JOIN enrollments e ON (((e.student_id = s_1.id) AND (e.status = 'approved'::text))))
             LEFT JOIN installments i ON ((i.enrollment_id = e.id)))
          GROUP BY s_1.id
        )
 SELECT s.id,
    s.name,
    s.status,
    cc.class_name,
    cc.class_id,
    COALESCE(ast.total_days, (0)::bigint) AS att_total,
    COALESCE(ast.present_days, (0)::bigint) AS att_present,
        CASE
            WHEN (COALESCE(ast.total_days, (0)::bigint) = 0) THEN (0)::numeric
            ELSE round((((ast.present_days)::numeric / (ast.total_days)::numeric) * (100)::numeric), 1)
        END AS attendance_rate,
    COALESCE(fs.overdue_count, (0)::bigint) AS overdue_count,
    COALESCE(fs.pending_count, (0)::bigint) AS pending_count
   FROM (((students s
     LEFT JOIN current_classes cc ON ((s.id = cc.student_id)))
     LEFT JOIN attendance_stats ast ON ((s.id = ast.student_id)))
     LEFT JOIN financial_stats fs ON ((s.id = fs.student_id)));

-- 5. FUNCTIONS

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'ADMIN'::user_role
  );
$function$;

-- Helper for triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
 BEGIN
    NEW.updated_at = now();
    RETURN NEW;
 END;
 $function$;

-- 6. SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Exemplo de Policies Consolidadas
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins manage everything" ON public.students FOR ALL USING (public.is_admin());
CREATE POLICY "Parents view own children" ON public.students FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = students.id AND guardian_id = auth.uid())
);

-- Notificações Segurança corrigida anteriormente
CREATE POLICY "Everyone can read general settings" ON public.app_settings FOR SELECT USING (NOT (key IN ('finance_gateway_config', 'whatsapp_config', 'smtp_config')));
CREATE POLICY "Admins can read sensitive settings" ON public.app_settings FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'::user_role);
