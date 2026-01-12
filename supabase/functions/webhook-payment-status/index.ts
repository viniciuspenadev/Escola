// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
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

        const event = await req.json()
        console.log('Webhook Asaas Received:', JSON.stringify(event))

        // Validar Evento
        // Asaas envia: { event: "PAYMENT_RECEIVED", payment: { ... } }
        if (!event.event || !event.payment) {
            return new Response(JSON.stringify({ message: 'Ignored: Invalid Payload' }), { headers: corsHeaders, status: 200 })
        }

        const validEvents = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']
        if (!validEvents.includes(event.event)) {
            console.log(`Evento ignorado: ${event.event}`)
            return new Response(JSON.stringify({ message: 'Ignored: Not a confirmation event' }), { headers: corsHeaders, status: 200 })
        }

        const asaasId = event.payment.id
        const paymentDate = event.payment.paymentDate || new Date().toISOString()
        const billingType = event.payment.billingType // BOLETO, PIX, CREDIT_CARD

        console.log(`Processando pagamento ${asaasId} - Tipo: ${billingType}`)

        // Buscar Parcela
        const { data: installment, error: fetchError } = await supabaseClient
            .from('installments')
            .select('id, status')
            .eq('gateway_integration_id', asaasId)
            .single()

        if (fetchError || !installment) {
            console.error('Parcela não encontrada para este ID Asaas:', asaasId)
            // Retornar 200 para o Asaas não ficar tentando reenviar se for erro de dado nosso
            return new Response(JSON.stringify({ error: 'Installment not found' }), { headers: corsHeaders, status: 200 })
        }

        if (installment.status === 'paid') {
            console.log('Parcela já está paga.')
            return new Response(JSON.stringify({ message: 'Already paid' }), { headers: corsHeaders, status: 200 })
        }

        // Atualizar Status
        const updatePayload = {
            status: 'paid',
            paid_at: paymentDate,
            payment_method: billingType === 'PIX' ? 'pix' : 'boleto' // Simplify mapping
        }

        const { error: updateError } = await supabaseClient
            .from('installments')
            .update(updatePayload)
            .eq('id', installment.id)

        if (updateError) throw updateError

        console.log(`Parcela ${installment.id} atualizada para PAGO.`)

        return new Response(JSON.stringify({ message: 'Success' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Webhook Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
