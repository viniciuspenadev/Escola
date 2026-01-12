-- 1. Tabela de Configurações Globais do Sistema
-- Armazena configurações sensíveis e preferências de forma estruturada (JSON)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(50) PRIMARY KEY, -- ex: 'whatsapp_config', 'smtp_config'
    value JSONB NOT NULL,        -- ex: { "url": "...", "active": true }
    description TEXT,            -- Para documentar o que é essa config
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Segurança (RLS) para app_settings:
-- APENAS Admins podem ler/escrever. O Edge Function (Service Role) tem acesso total.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON public.app_settings
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 2. Tabela de Logs de Envio de Notificações
-- Para você saber o que foi enviado e se deu erro
CREATE TABLE IF NOT EXISTS public.wpp_notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID REFERENCES public.notifications(id),
    channel VARCHAR(20) DEFAULT 'whatsapp',
    status VARCHAR(20) NOT NULL,  -- 'sent', 'failed', 'pending'
    
    -- Dados técnicos para debug
    provider_response JSONB,      -- O que a Evolution API respondeu
    error_message TEXT,           -- Se falhou, por que falhou?
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para Logs:
ALTER TABLE public.wpp_notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view logs" ON public.wpp_notification_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Exemplo de Insert inicial (o que o painel vai fazer):
INSERT INTO public.app_settings (key, value, description)
VALUES (
    'whatsapp_config', 
    '{
        "url": "https://n8n-evolution-api.3qeebj.easypanel.host",
        "apikey": "429683C4C977415CAAFCCE10F7D57E11",
        "instance": "Evolution",
        "enabled_channels": {
            "finance": true,
            "diary": false,
            "occurrence": true
        }
    }',
    'Configurações de conexão e regras de envio do WhatsApp'
) ON CONFLICT DO NOTHING;
