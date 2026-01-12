-- Financial Categories (e.g., 'Energia', 'Aluguel', 'Material de Escritório')
CREATE TABLE IF NOT EXISTS public.financial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Transactions (Unified Ledger, primarily for Expenses now)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category_id UUID REFERENCES public.financial_categories(id),
    
    -- Dates
    due_date DATE NOT NULL,
    payment_date DATE, -- Null if pending
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    
    -- Metadata
    payment_method TEXT, -- 'pix', 'boleto', 'transfer', 'cash'
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Policies (Admins only)
CREATE POLICY "Admins full access categories" ON public.financial_categories
FOR ALL USING (public.is_admin());

CREATE POLICY "Admins full access transactions" ON public.financial_transactions
FOR ALL USING (public.is_admin());

-- Seed Categories
INSERT INTO public.financial_categories (name, type) VALUES
('Aluguel', 'expense'),
('Energia Elétrica', 'expense'),
('Água / Saneamento', 'expense'),
('Internet / Telefone', 'expense'),
('Salários', 'expense'),
('Material de Limpeza', 'expense'),
('Material de Escritório', 'expense'),
('Manutenção Predial', 'expense'),
('Lanche / Alimentação', 'expense'),
('Receita Mensalidades', 'income') -- For future use
ON CONFLICT DO NOTHING;
