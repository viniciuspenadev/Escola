-- Financial Plans Table
CREATE TABLE IF NOT EXISTS public.financial_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    total_value DECIMAL(10,2) NOT NULL,
    installments_count INTEGER NOT NULL DEFAULT 12,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Installments Table (Linked to Enrollment)
CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.financial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

-- Policies (Admins only for now)
CREATE POLICY "Admins full access plans" ON public.financial_plans
FOR ALL USING (public.is_admin());

CREATE POLICY "Admins full access installments" ON public.installments
FOR ALL USING (public.is_admin());

-- Seed Data
INSERT INTO public.financial_plans (title, total_value, installments_count) VALUES
('Anual 2025 (Integral)', 25000.00, 1),
('Anual 2025 (12x)', 27600.00, 12),
('Semestral (6x)', 15000.00, 6)
ON CONFLICT DO NOTHING;
