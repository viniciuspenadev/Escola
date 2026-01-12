
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for User Roles (simpler handling in Supabase Auth, but good for DB validity)
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'SECRETARY', 'TEACHER', 'PARENT');

-- Profiles (Linked to Auth Users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role public.user_role DEFAULT 'PARENT',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students Table (The Final Record)
CREATE TABLE public.students (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    birth_date DATE,
    parent_id UUID REFERENCES public.profiles(id),
    photo_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollments / Applications Table (The Process)
CREATE TABLE public.enrollments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Initial Admin Input
    candidate_name TEXT NOT NULL, -- Name before student record exists
    parent_name TEXT,
    parent_email TEXT NOT NULL,
    
    -- The Magic Link Token
    invite_token UUID DEFAULT uuid_generate_v4(),
    
    -- Process Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'completed', 'approved', 'rejected')),
    
    -- Link to final student record (once enrolled)
    student_id UUID REFERENCES public.students(id),
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (Simplified for now - Enable manually in Dashboard if needed)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins full access" ON public.enrollments
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SECRETARY'))
);

-- Policy: Parents can view their own enrollments (via email match for now? or token?)
-- For the public wizard, we will select by 'invite_token' using a distinct function or open policy for specific token read.
