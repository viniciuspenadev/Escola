-- FIX: Reset corrupted JSON data in app_settings
-- The previous data was saved as an array-like object of characters due to a serialization issue.
-- This script restores a clean, valid JSON object structure.

UPDATE public.app_settings
SET value = '{
    "url": "https://n8n-evolution-api.3qeebj.easypanel.host",
    "apikey": "429683C4C977415CAAFCCE10F7D57E11",
    "instance": "Evolution",
    "enabled_channels": {
        "finance": true,
        "diary": false,
        "occurrence": true
    }
}'::jsonb,
updated_at = NOW()
WHERE key = 'whatsapp_config';

-- If the row doesn't exist, insert it correctly
INSERT INTO public.app_settings (key, value, description)
SELECT 'whatsapp_config', '{
    "url": "https://n8n-evolution-api.3qeebj.easypanel.host",
    "apikey": "429683C4C977415CAAFCCE10F7D57E11",
    "instance": "Evolution",
    "enabled_channels": {
        "finance": true,
        "diary": false,
        "occurrence": true
    }
}'::jsonb, 'Configurações de conexão Evolution API'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'whatsapp_config');
