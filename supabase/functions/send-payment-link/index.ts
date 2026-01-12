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

        // 1. Validar e Receber Payload
        const { installment_ids } = await req.json()
        if (!installment_ids || !Array.isArray(installment_ids) || installment_ids.length === 0) {
            throw new Error('Nenhuma mensalidade selecionada.')
        }

        console.log(`Iniciando geração para ${installment_ids.length} parcelas...`)

        // 2. Buscar Configuração do Gateway
        const { data: settingsData, error: settingsError } = await supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'finance_gateway_config')
            .single()

        if (settingsError || !settingsData?.value) {
            throw new Error('Gateway de pagamento não configurado.')
        }

        // Handle stringified JSON or object
        const config = typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value

        if (config.provider !== 'asaas' || !config.api_key) {
            throw new Error('Provedor Asaas não está ativo ou sem API Key.')
        }

        const ASAAS_URL = config.environment === 'production'
            ? 'https://api.asaas.com/api/v3'
            : 'https://sandbox.asaas.com/api/v3'

        const ASAAS_HEADERS = {
            'Content-Type': 'application/json',
            'access_token': config.api_key
        }

        // 3. Buscar Dados das Parcelas e Responsáveis
        const { data: installments, error: instError } = await supabaseClient
            .from('installments')
            .select(`
        id, value, due_date, installment_number,
        enrollment:enrollments (
          id, candidate_name, 
          details
        )
      `)
            .in('id', installment_ids)

        if (instError || !installments) throw instError

        const results = []

        // 4. Processar cada parcela
        for (const inst of installments) {
            try {
                const details = inst.enrollment.details || {}

                // Dados do Pagador (Preferência: Responsável Financeiro, Fallback: Pai/Mãe)
                // Adjust based on your specific 'details' structure logic
                let payerName = details.parent_name || details.financial_responsible?.name || inst.enrollment.candidate_name
                let payerCpf = details.parent_cpf || details.financial_responsible?.cpf || details.student_cpf

                // Limpar CPF
                payerCpf = payerCpf ? payerCpf.replace(/\D/g, '') : null

                if (!payerCpf) {
                    throw new Error(`CPF do responsável não encontrado para ${inst.enrollment.candidate_name}`)
                }

                // 4.1. Buscar/Criar Cliente no Asaas
                // Buscar por CPF
                const searchRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${payerCpf}`, { headers: ASAAS_HEADERS })
                const searchData = await searchRes.json()

                let customerId = null

                if (searchData.data && searchData.data.length > 0) {
                    customerId = searchData.data[0].id
                } else {
                    // Criar novo
                    const createRes = await fetch(`${ASAAS_URL}/customers`, {
                        method: 'POST',
                        headers: ASAAS_HEADERS,
                        body: JSON.stringify({
                            name: payerName,
                            cpfCnpj: payerCpf,
                            email: details.parent_email || 'email@exemplo.com', // Asaas requires email usually
                            notificationDisabled: false
                        })
                    })
                    const createData = await createRes.json()
                    if (!createRes.ok) throw new Error(`Erro criar cliente Asaas: ${JSON.stringify(createData.errors)}`)
                    customerId = createData.id
                }

                // 4.2. Criar Cobrança
                const paymentPayload = {
                    customer: customerId,
                    billingType: 'BOLETO', // Gera Boleto + Pix no Asaas
                    value: inst.value,
                    dueDate: inst.due_date,
                    description: `Mensalidade ${inst.installment_number} - ${inst.enrollment.candidate_name}`,
                    externalReference: inst.id
                }

                const payRes = await fetch(`${ASAAS_URL}/payments`, {
                    method: 'POST',
                    headers: ASAAS_HEADERS,
                    body: JSON.stringify(paymentPayload)
                })

                const payData = await payRes.json()

                if (!payRes.ok) {
                    throw new Error(`Erro Asaas: ${payData.errors?.[0]?.description || 'Erro desconhecido'}`)
                }

                // 4.3. Salvar no Banco
                const { error: updateError } = await supabaseClient
                    .from('installments')
                    .update({
                        gateway_integration_id: payData.id,
                        billing_url: payData.bankSlipUrl, // URL A4 do Boleto
                        payment_method: 'boleto', // Set to Boleto/Gateway
                        is_published: true // Auto-publish so parents can see it immediately
                    })
                    .eq('id', inst.id)

                if (updateError) throw updateError

                results.push({ id: inst.id, status: 'success', asaas_id: payData.id })

            } catch (err) {
                console.error(`Falha parcela ${inst.id}:`, err)
                results.push({ id: inst.id, status: 'error', message: err.message })
            }
        }

        return new Response(JSON.stringify({ processed: results.length, details: results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Fatal Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
