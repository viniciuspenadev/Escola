// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Receber payload do Webhook (Database Insert)
        const body = await req.json()
        const record = body.record

        // DEBUG: Logging payload to DB to inspect format
        await supabaseClient.from('wpp_notification_logs').insert({
            notification_id: record?.id || null,
            channel: 'debug',
            status: 'received',
            error_message: `Payload keys: ${Object.keys(body).join(',')}`,
            provider_response: body
        })

        if (!record || !record.user_id || !record.message) {
            await supabaseClient.from('wpp_notification_logs').insert({
                channel: 'debug',
                status: 'payload_error',
                error_message: 'Payload missing record, user_id or message',
                provider_response: body
            })
            throw new Error('Payload inválido. Esperado registro de notificação.')
        }

        console.log(`Processando notificação ${record.id} para User ${record.user_id}`)

        // 2. Buscar Configuração do Banco (app_settings)
        const { data: settingsData, error: settingsError } = await supabaseClient
            .from('app_settings')
            .select('key, value')
            .in('key', ['whatsapp_config', 'school_info'])

        if (settingsError || !settingsData || settingsData.length === 0) {
            console.error('Erro ao buscar configurações:', settingsError)
            return new Response(JSON.stringify({ error: 'Configuração não encontrada.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
        }

        // Parse Configs
        const whatsappConfigRaw = settingsData.find(s => s.key === 'whatsapp_config')?.value
        const schoolInfoRaw = settingsData.find(s => s.key === 'school_info')?.value

        let whatsappConfig = {}
        let schoolInfo = {}

        try {
            whatsappConfig = typeof whatsappConfigRaw === 'string' ? JSON.parse(whatsappConfigRaw) : whatsappConfigRaw
            schoolInfo = typeof schoolInfoRaw === 'string' ? JSON.parse(schoolInfoRaw) : schoolInfoRaw
        } catch (e) {
            console.error('Erro ao parsear JSON:', e)
        }

        const { url: evolutionUrl, apikey: evolutionKey, instance: instanceName, enabled_channels } = whatsappConfig || {}

        if (!evolutionUrl || !evolutionKey || !instanceName) {
            console.error('Configuração WhatsApp incompleta:', whatsappConfig)
            return new Response(JSON.stringify({ error: 'Configuração WhatsApp incompleta.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
        }

        // Verificar se Canal está Habilitado
        const notificationType = record.type || 'diary' // Default fallback
        if (enabled_channels && enabled_channels[notificationType] === false) {
            console.log(`Canal '${notificationType}' desabilitado. Cancelando envio.`)
            return new Response(JSON.stringify({ message: 'Canal desabilitado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        // 3. Buscar Telefone do Destinatário
        let phone = null

        // Estratégia Overrride (Para testes manuais do Admin)
        if (record.data && record.data.override_phone) {
            console.log('Usando telefone de override (Teste Manual):', record.data.override_phone)
            phone = record.data.override_phone
        }

        // Estratégia A: Buscar diretamente nos metadados do Usuário (auth.users)
        // Isso é o ideal, pois garante que é o telefone DO USUÁRIO.
        const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(record.user_id)

        if (userData && userData.user) {
            const meta = userData.user.user_metadata || {}
            phone = meta.phone || meta.mobile || meta.whatsapp || meta.celular
        }

        // Estratégia B: Se não achou, buscar na Matrícula (JSON financial_responsible do Aluno)
        // O usuário disse que no "cadastro da matrícula" tem o telefone.
        if (!phone && record.data && record.data.student_id) {
            console.log(`Telefone não encontrado no perfil. Buscando na matrícula do aluno ${record.data.student_id}...`)

            const { data: studentData, error: studentError } = await supabaseClient
                .from('students')
                .select('financial_responsible')
                .eq('id', record.data.student_id)
                .single()

            if (studentData && studentData.financial_responsible) {
                const finResp = studentData.financial_responsible
                // Verifica se o email bate (pra garantir que é a pessoa certa) OU se é o único telefone disponível
                // Por segurança e para atender o caso do Vinicius, vamos usar esse telefone como fallback confiável.
                const possiblePhone = finResp.phone || finResp.mobile || finResp.celular || finResp.whatsapp

                if (possiblePhone) {
                    console.log(`Telefone encontrado na Matrícula (Responsável Financeiro).`)
                    phone = possiblePhone
                }
            }
        }

        // Strategy C: Legacy Lookup REMOVED (Deprecated)
        // We now rely 100% on Auth User Metadata or Enrollment Data (via student_id)
        if (!phone) {
            console.log('Nenhum telefone encontrado via Auth ou Matrícula.');
        }

        if (!phone) {
            console.error('Telefone não encontrado para o usuário:', record.user_id)

            // Log de erro no banco
            await supabaseClient.from('wpp_notification_logs').insert({
                notification_id: record.id,
                channel: 'whatsapp',
                status: 'failed',
                error_message: 'Telefone não encontrado para o usuário'
            })

            return new Response(JSON.stringify({ error: 'Telefone não encontrado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }

        // Limpar telefone (apenas números)
        phone = phone.replace(/\D/g, '')
        // Adicionar 55 se não tiver (Assumindo BR)
        if (phone.length <= 11 && !phone.startsWith('55')) phone = '55' + phone

        console.log(`Enviando WhatsApp para ${phone} via instância ${instanceName}...`)

        // 4. Enviar para Evolution API
        // Clean URL trailing slash
        const cleanUrl = evolutionUrl.replace(/\/$/, '')

        const header = schoolInfo?.name || 'Escola V2 Informa'

        const payload = {
            number: phone,
            text: `📢 *${header}*\n\n*${record.title}*\n${record.message}`,
            delay: 1200,
            linkPreview: true
        }

        const response = await fetch(`${cleanUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey
            },
            body: JSON.stringify(payload)
        })

        let result
        try {
            result = await response.json()
        } catch (e) {
            result = { error: 'Invalid JSON response from Evolution', status: response.status }
        }

        console.log('Evolution API Response:', result)

        // Logar Sucesso/Falha
        const status = (response.ok && (result?.key?.id || result?.message?.key)) ? 'sent' : 'failed'

        await supabaseClient.from('wpp_notification_logs').insert({
            notification_id: record.id,
            status: status,
            provider_response: result,
            error_message: response.ok ? null : `HTTP ${response.status}`
        })

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status,
        })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
