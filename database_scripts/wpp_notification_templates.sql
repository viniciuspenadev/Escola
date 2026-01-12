-- 1. Create Table for Templates
CREATE TABLE IF NOT EXISTS public.wpp_notification_templates (
    key TEXT PRIMARY KEY,
    title_template TEXT NOT NULL,
    message_template TEXT NOT NULL,
    variables_description TEXT, -- Help text for user (e.g. "Available vars: {{student_name}}")
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Secure with RLS
ALTER TABLE public.wpp_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates" 
ON public.wpp_notification_templates 
FOR ALL 
TO authenticated 
USING (is_admin()) 
WITH CHECK (is_admin());

-- 3. Seed Initial Templates (Diary, Finance)
INSERT INTO public.wpp_notification_templates (key, title_template, message_template, variables_description)
VALUES 
(
    'diary_update', 
    'Diário Escolar Atualizado 📝', 
    'O diário de {{student_name}} foi atualizado. Confira as atividades e rotina de hoje no aplicativo.',
    'Variáveis: {{student_name}}'
),
(
    'finance_new_bill', 
    'Mensalidade Disponível 💰', 
    'Sua fatura com vencimento em {{due_date}} já está disponível no app.',
    'Variáveis: {{due_date}}'
),
(
    'finance_paid', 
    'Pagamento Confirmado ✅', 
    'Recebemos seu pagamento da parcela de {{month}}. Obrigado!',
    'Variáveis: {{month}}'
)
ON CONFLICT (key) DO UPDATE 
SET 
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template;
