-- Create tables for the Leads/CRM System

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT, -- Not unique because parents might have multiple leads or re-enter
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualifying', 'scheduled', 'waiting', 'lost', 'converted')),
    source TEXT NOT NULL DEFAULT 'lp', -- lp, referral, manual, etc.
    priority TEXT NOT NULL DEFAULT 'warm' CHECK (priority IN ('hot', 'warm', 'cold')),
    assigned_to UUID REFERENCES public.profiles(id), -- SDR responsible
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Lead Children Table (One Lead can have multiple children)
CREATE TABLE IF NOT EXISTS public.lead_children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    birth_date DATE,
    intended_grade TEXT, -- e.g., "Berçário", "Maternal", "1º Ano"
    previous_school TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Lead Interactions Table (History/Timeline)
CREATE TABLE IF NOT EXISTS public.lead_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('call', 'whatsapp', 'email', 'note', 'meeting')),
    content TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

-- Policies

-- LEADs:
-- Public (Anon) can INSERT (Submit form)
CREATE POLICY "Public can insert leads" ON public.leads
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Admins/Staff can VIEW ALL
CREATE POLICY "Admins can view all leads" ON public.leads
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'SECRETARY', 'COORDINATOR')
        )
    );

-- Admins/Staff can UPDATE ALL
CREATE POLICY "Admins can update leads" ON public.leads
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'SECRETARY', 'COORDINATOR')
        )
    );

-- LEAD CHILDREN:
-- Public can INSERT
CREATE POLICY "Public can insert lead_children" ON public.lead_children
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Admins can VIEW/UPDATE
CREATE POLICY "Admins can manage lead_children" ON public.lead_children
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'SECRETARY', 'COORDINATOR')
        )
    );

-- INTERACTIONS:
-- Only Authenticated Staff can manage interactions
CREATE POLICY "Staff can manage interactions" ON public.lead_interactions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'SECRETARY', 'COORDINATOR')
        )
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads(status);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS lead_children_lead_id_idx ON public.lead_children(lead_id);
CREATE INDEX IF NOT EXISTS lead_interactions_lead_id_idx ON public.lead_interactions(lead_id);
