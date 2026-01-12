import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useConfirm } from '../contexts/ConfirmContext';
import { Card, Button, Input, Badge } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import {
    CheckCircle,
    QrCode,
    FileText,
    Eye,
    EyeOff,
    Share2,
    Percent,
    TrendingDown,
    TrendingUp,
    CreditCard,
    ExternalLink,
    Loader2
} from 'lucide-react';
import type { GatewayConfig } from './admin/FinancialSettingsTab';

export const ChargeDetailsView: FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { confirm } = useConfirm();

    const [loading, setLoading] = useState(true);
    const [charge, setCharge] = useState<any>(null);
    const [metadata, setMetadata] = useState({
        pix_key: '',
        boleto_code: '',
        boleto_url: ''
    });

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentData, setPaymentData] = useState({
        method: 'pix',
        date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD local
        obs: ''
    });

    // Negotiation State
    const [negotiationModalOpen, setNegotiationModalOpen] = useState(false);
    const [negotiationData, setNegotiationData] = useState({
        type: 'discount', // or 'surcharge'
        mode: 'fixed', // or 'percent'
        value: 0,
        notes: ''
    });

    // Date Editing State
    const [dateEditModalOpen, setDateEditModalOpen] = useState(false);
    const [dateEditData, setDateEditData] = useState({
        field: 'due_date' as 'due_date' | 'paid_at',
        label: '',
        value: ''
    });

    // Gateway State
    const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null);
    const [generatingPayment, setGeneratingPayment] = useState(false);

    useEffect(() => {
        fetchChargeDetails();
        fetchGatewayConfig();
    }, [id]);

    const fetchGatewayConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'finance_gateway_config')
                .maybeSingle();

            if (error) throw error;
            if (data) {
                let val = data.value;
                if (typeof val === 'string') {
                    try { val = JSON.parse(val); } catch (e) { console.error('Error parsing gateway config JSON', e); }
                }
                setGatewayConfig(val as GatewayConfig);
            }
        } catch (err) {
            console.error('Error fetching gateway config:', err);
        }
    };

    const fetchChargeDetails = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('installments')
                .select(`
                    *,
                    enrollment:enrollments(
                        id,
                        student:students(*)
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setCharge(data);
            if (data.metadata) {
                setMetadata({
                    pix_key: data.metadata.pix_key || '',
                    boleto_code: data.metadata.boleto_code || '',
                    boleto_url: data.metadata.boleto_url || ''
                });
            }
        } catch (error: any) {
            console.error('Error fetching charge:', error);
            addToast('error', 'Erro ao carregar cobrança');
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePayment = async () => {
        if (!gatewayConfig || gatewayConfig.provider !== 'asaas') {
            addToast('error', 'Gateway Asaas não configurado.');
            return;
        }

        const isConfirmed = await confirm({
            title: 'Gerar Cobrança (Asaas)',
            message: 'Deseja gerar Pix e Boleto automaticamente para esta mensalidade? O valor será registrado no Asaas.',
            confirmText: 'Gerar Agora'
        });
        if (!isConfirmed) return;

        setGeneratingPayment(true);
        try {
            const { error } = await supabase.functions.invoke('send-payment-link', {
                body: { installment_ids: [id] }
            });

            if (error) throw error;
            addToast('success', 'Cobrança gerada com sucesso via Asaas!');
            fetchChargeDetails(); // Refresh to see new billing_url
        } catch (err: any) {
            console.error(err);
            addToast('error', 'Erro ao gerar cobrança: ' + err.message);
        } finally {
            setGeneratingPayment(false);
        }
    };

    const handleSaveConfig = async (shouldPublish: boolean = false) => {
        try {
            // Smart validation
            if (shouldPublish && !metadata.pix_key && !metadata.boleto_code && !metadata.boleto_url && !charge.billing_url) {
                const isConfirmed = await confirm({
                    title: 'Método de Pagamento Ausente',
                    message: 'Você está liberando a cobrança sem nenhum método de pagamento (Pix/Boleto, Link) configurado. O responsável verá a cobrança mas não conseguirá pagar. Deseja continuar?',
                    type: 'warning',
                    confirmText: 'Liberar Mesmo Assim'
                });

                if (!isConfirmed) return;
            }

            const updates: any = {
                metadata: {
                    ...charge.metadata,
                    pix_key: metadata.pix_key,
                    boleto_code: metadata.boleto_code,
                    boleto_url: metadata.boleto_url
                }
            };

            if (shouldPublish) {
                updates.is_published = true;
            }

            const { error } = await supabase
                .from('installments')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            addToast('success', shouldPublish ? 'Cobrança salva e liberada para o responsável!' : 'Configurações salvas (Rascunho)');
            fetchChargeDetails();
        } catch (error: any) {
            addToast('error', 'Erro ao salvar: ' + error.message);
        }
    };

    const handleTogglePublish = async () => {
        try {
            const newStatus = !charge.is_published;
            const { error } = await supabase
                .from('installments')
                .update({ is_published: newStatus })
                .eq('id', id);

            if (error) throw error;
            setCharge({ ...charge, is_published: newStatus });
            addToast('success', newStatus ? 'Cobrança publicada!' : 'Cobrança ocultada (Rascunho)');
        } catch (error: any) {
            addToast('error', 'Erro ao atualizar status: ' + error.message);
        }
    };

    const handleMarkAsPaid = async () => {
        const isConfirmed = await confirm({
            title: 'Confirmar Recebimento',
            message: 'Confirmar recebimento deste valor?',
            type: 'success',
            confirmText: 'Confirmar Recebimento'
        });

        if (!isConfirmed) return;

        try {
            const { error } = await supabase
                .from('installments')
                .update({
                    status: 'paid',
                    paid_at: new Date(paymentData.date).toISOString(),
                    payment_method: paymentData.method,
                    metadata: {
                        ...charge.metadata,
                        manual_obs: paymentData.obs
                    }
                })
                .eq('id', id);

            if (error) throw error;
            addToast('success', 'Pagamento confirmado com sucesso!');
            setPaymentModalOpen(false);
            fetchChargeDetails();
        } catch (error: any) {
            addToast('error', 'Erro ao dar baixa: ' + error.message);
        }
    };

    const handleNegotiationSave = async () => {
        try {
            const isConfirmed = await confirm({
                title: 'Confirmar Negociação',
                message: 'O valor da cobrança será alterado. Confirmar negociação?',
                type: 'warning',
                confirmText: 'Confirmar'
            });

            if (!isConfirmed) return;

            const originalValue = charge.original_value || charge.value;
            let finalValue = Number(originalValue);
            let discountValue = 0;
            let surchargeValue = 0;

            const adjustmentValue = Number(negotiationData.value);

            if (negotiationData.type === 'discount') {
                if (negotiationData.mode === 'fixed') {
                    discountValue = adjustmentValue;
                } else {
                    discountValue = originalValue * (adjustmentValue / 100);
                }
                finalValue = originalValue - discountValue;
            } else { // surcharge
                if (negotiationData.mode === 'fixed') {
                    surchargeValue = adjustmentValue;
                } else {
                    surchargeValue = originalValue * (adjustmentValue / 100);
                }
                finalValue = originalValue + surchargeValue;
            }

            if (gatewayConfig?.provider === 'asaas' && charge.gateway_integration_id) {
                // Call Edge Function for Asaas Update
                const { error: fnError } = await supabase.functions.invoke('manage-payment', {
                    body: {
                        action: 'update_value',
                        installment_id: id,
                        payload: {
                            newValue: finalValue,
                            discount_value: discountValue,
                            surcharge_value: surchargeValue,
                            negotiation_notes: negotiationData.notes,
                            negotiation_type: negotiationData.type,
                        }
                    }
                });
                if (fnError) throw fnError;
            } else {
                // Local Only Update
                const { error } = await supabase
                    .from('installments')
                    .update({
                        value: finalValue,
                        original_value: originalValue,
                        discount_value: discountValue,
                        surcharge_value: surchargeValue,
                        negotiation_type: negotiationData.type,
                        negotiation_notes: negotiationData.notes,
                        negotiation_date: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;
            }

            addToast('success', 'Negociação aplicada com sucesso!');
            setNegotiationModalOpen(false);
            fetchChargeDetails();

        } catch (error: any) {
            addToast('error', 'Erro ao salvar negociação: ' + error.message);
        }
    };

    const openDateEdit = (field: 'due_date' | 'paid_at') => {
        setDateEditData({
            field,
            label: field === 'due_date' ? 'Vencimento' : 'Data de Pagamento',
            value: charge[field] ? new Date(charge[field]).toISOString().substring(0, 10) : ''
        });
        setDateEditModalOpen(true);
    };

    const handleDateSave = async () => {
        try {
            const { error } = await supabase
                .from('installments')
                .update({
                    [dateEditData.field]: new Date(dateEditData.value).toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            addToast('success', 'Data atualizada com sucesso!');
            setDateEditModalOpen(false);
            fetchChargeDetails();
        } catch (error: any) {
            addToast('error', error.message);
        }
    };

    const handleCancelCharge = async () => {
        const isConfirmed = await confirm({
            title: 'Cancelar Cobrança',
            message: 'Tem certeza? Isso cancelará a cobrança no sistema' + (hasGateway ? ' e no Asaas.' : '.'),
            type: 'danger',
            confirmText: 'Sim, Cancelar'
        });

        if (!isConfirmed) return;

        try {
            if (gatewayConfig?.provider === 'asaas' && charge.gateway_integration_id) {
                // Call Edge Function
                const { error } = await supabase.functions.invoke('manage-payment', {
                    body: { action: 'cancel', installment_id: id }
                });
                if (error) throw error;
            } else {
                // Local Cancel
                const { error } = await supabase
                    .from('installments')
                    .update({ status: 'cancelled', is_published: false })
                    .eq('id', id);
                if (error) throw error;
            }

            addToast('success', 'Cobrança cancelada com sucesso.');
            fetchChargeDetails();
        } catch (error: any) {
            addToast('error', 'Erro ao cancelar: ' + error.message);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
    );

    if (!charge) return <div className="p-8 text-center text-gray-500">Cobrança não encontrada.</div>;

    const isPaid = charge.status === 'paid';
    const isOverdue = charge.status === 'pending' && new Date(charge.due_date) < new Date();
    const isPublished = charge.is_published;
    const hasGateway = !!charge.billing_url;

    // Status Badge Logic
    const StatusBadge = () => {
        if (isPaid) return <Badge variant="success">PAGO</Badge>;
        if (isOverdue) return <Badge variant="danger">ATRASADO</Badge>;
        return <Badge variant="warning">PENDENTE</Badge>;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in text-gray-800">
            {/* Nav Header */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <span className="cursor-pointer hover:text-brand-600" onClick={() => navigate('/financeiro')}>Financeiro</span>
                <span className="text-gray-300">/</span>
                <span className="cursor-pointer hover:text-brand-600" onClick={() => navigate('/financeiro/recebiveis')}>Mensalidades</span>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900 font-medium">Detalhes da Cobrança</span>
            </div>

            {/* Main Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900">
                                Parcela {charge.installment_number}
                            </h1>
                            <StatusBadge />
                            {/* Publish Status Toggle */}
                            <div
                                onClick={handleTogglePublish}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${isPublished
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                    }`}
                                title={isPublished ? "Visível para o responsável" : "Oculto para o responsável (Rascunho)"}
                            >
                                {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                {isPublished ? 'PUBLICADO' : 'RASCUNHO'}
                            </div>
                        </div>
                        <p className="text-gray-500">
                            Matrícula <span className="font-mono text-gray-700">#{charge.enrollment_id?.slice(0, 8)}</span> • {charge.enrollment?.student?.name}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-sm font-medium text-gray-500 mb-1">Valor Total</p>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.value)}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 flex items-center justify-end gap-2 group">
                        <span>Vencimento:</span>
                        <span className={isOverdue && !isPaid ? "text-red-600 font-bold" : "text-gray-700 font-medium"}>
                            {new Date(charge.due_date).toLocaleDateString('pt-BR')}
                        </span>
                        {!isPaid && (
                            <button
                                onClick={() => openDateEdit('due_date')}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-brand-600 transition-opacity"
                                title="Editar Vencimento"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                            </button>
                        )}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Details & Configuration */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Invoice Details Card */}
                    <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-500" />
                                Resumo Financeiro
                            </h3>
                            <span className="text-xs font-mono text-gray-400">ID: {charge.id}</span>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between py-2 border-b border-gray-50">
                                <span className="text-gray-600">Valor Original</span>
                                <span className="font-medium text-gray-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.original_value || charge.value)}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-50">
                                <span className="text-gray-600">Juros / Multa</span>
                                <span className={`font-medium ${charge.surcharge_value > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    {charge.surcharge_value > 0
                                        ? `+ ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.surcharge_value)}`
                                        : '--'}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-50">
                                <span className="text-gray-600">Descontos</span>
                                <span className={`font-medium ${charge.discount_value > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {charge.discount_value > 0
                                        ? `- ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.discount_value)}`
                                        : '--'}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 pt-4">
                                <span className="text-lg font-bold text-gray-800">Total a Pagar</span>
                                <span className="text-lg font-bold text-brand-700">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.value)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Payment Methods Configuration */}
                    <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <QrCode className="w-4 h-4 text-gray-500" />
                                Configuração de Recebimento
                            </h3>
                            {isPaid ? (
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Liquidado</span>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => handleSaveConfig(false)} className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline">
                                        Salvar Rascunho
                                    </button>
                                    {!isPublished && (
                                        <button onClick={() => handleSaveConfig(true)} className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline">
                                            Salvar & Publicar
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {hasGateway ? (
                            <div className="p-6 bg-brand-50/50">
                                <div className="flex items-center gap-4 p-4 bg-white border border-brand-100 rounded-xl shadow-sm">
                                    <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-lg flex items-center justify-center">
                                        <CreditCard className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900">Cobrança Gerada no Asaas</h4>
                                        <p className="text-xs text-gray-500">Pix e Boleto estão ativos e vinculados.</p>
                                    </div>
                                    <a
                                        href={charge.billing_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition flex items-center gap-2"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Ver Fatura
                                    </a>
                                </div>
                                <div className="mt-4 flex gap-4 text-xs text-gray-500 justify-center">
                                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Boleto Bancário</span>
                                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Pix QR Code</span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                <div className="space-y-3 opacity-100 transition-opacity">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                                        Chave Pix (Manual)
                                    </label>
                                    <Input
                                        disabled={isPaid}
                                        value={metadata.pix_key}
                                        onChange={e => setMetadata({ ...metadata, pix_key: e.target.value })}
                                        placeholder="CPF, Email ou Aleatória..."
                                        className="bg-gray-50/50"
                                    />
                                    <p className="text-xs text-gray-400">Chave usada para gerar o QR Code do aluno.</p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                                        Boleto Bancário (Manual)
                                    </label>
                                    <Input
                                        disabled={isPaid}
                                        value={metadata.boleto_code}
                                        onChange={e => setMetadata({ ...metadata, boleto_code: e.target.value })}
                                        placeholder="Linha digitável..."
                                        className="bg-gray-50/50"
                                    />
                                    <Input
                                        disabled={isPaid}
                                        value={metadata.boleto_url}
                                        onChange={e => setMetadata({ ...metadata, boleto_url: e.target.value })}
                                        placeholder="URL do PDF..."
                                        className="bg-gray-50/50"
                                    />
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right Column: Actions & Timeline */}
                <div className="space-y-6">
                    {/* Primary Actions */}
                    <Card className="p-5 border border-gray-200 shadow-lg shadow-gray-200/50">
                        <h3 className="font-semibold text-gray-900 mb-4">Ações</h3>
                        <div className="space-y-3">
                            {!isPaid ? (
                                <>
                                    {gatewayConfig?.provider === 'asaas' && !hasGateway && (
                                        <Button
                                            onClick={handleGeneratePayment}
                                            disabled={generatingPayment}
                                            className="w-full bg-brand-600 hover:bg-brand-700 text-white shadow-brand-200 shadow-md transition-all mb-2"
                                        >
                                            {generatingPayment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                                            Gerar Boleto/Pix (Asaas)
                                        </Button>
                                    )}

                                    <Button
                                        onClick={() => setPaymentModalOpen(true)}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-md transition-all"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Confirmar Pagamento
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start text-gray-600" disabled={!isPublished} title={!isPublished ? "Publique a cobrança para enviar" : ""}>
                                        <Share2 className="w-4 h-4 mr-2" /> Enviar Cobrança (WhatsApp)
                                    </Button>
                                    <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleCancelCharge}>
                                        Cancelar Cobrança
                                    </Button>
                                    <div className="pt-2 border-t border-gray-100 mt-2">
                                        <Button
                                            variant="outline"
                                            className="w-full border-dashed border-gray-300 text-gray-600 hover:border-brand-300 hover:text-brand-600"
                                            onClick={() => {
                                                setNegotiationData({ type: 'discount', mode: 'fixed', value: 0, notes: '' });
                                                setNegotiationModalOpen(true);
                                            }}
                                        >
                                            <Percent className="w-4 h-4 mr-2" />
                                            Negociar / Ajustar Valor
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                    <p className="font-bold text-emerald-800">Pagamento Confirmado</p>
                                    <p className="text-xs text-emerald-600 mt-1 flex items-center justify-center gap-1 group">
                                        {new Date(charge.paid_at).toLocaleString('pt-BR')}
                                        <button
                                            onClick={() => openDateEdit('paid_at')}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-emerald-400 hover:text-emerald-700 transition-opacity"
                                            title="Editar Data de Pagamento"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        </button>
                                    </p>
                                    <p className="text-xs text-emerald-600 font-mono uppercase mt-1">
                                        Via {charge.payment_method}
                                    </p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Timeline / Student Info */}
                    <Card className="p-5 border border-gray-200">
                        <h3 className="font-semibold text-gray-900 mb-4">Informações</h3>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-xs font-bold">
                                    {charge.enrollment?.student?.name?.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {charge.enrollment?.student?.name}
                                    </p>
                                    <p className="text-xs text-gray-500">Responsável Financeiro</p>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            <div className="relative pl-4 border-l-2 border-gray-100 space-y-6">
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-brand-500 ring-4 ring-white"></div>
                                    <p className="text-xs font-bold text-gray-900">Cobrança Gerada</p>
                                    <p className="text-[10px] text-gray-400">
                                        {new Date(charge.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                {isPublished && (
                                    <div className="relative animate-fade-in">
                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white"></div>
                                        <p className="text-xs font-bold text-blue-700">Disponível para Pagamento</p>
                                        <p className="text-[10px] text-gray-400">
                                            (Publicado)
                                        </p>
                                    </div>
                                )}

                                <div className="relative">
                                    <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full ring-4 ring-white ${isOverdue ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                                    <p className={`text-xs font-bold ${isOverdue ? 'text-red-700' : 'text-gray-900'}`}>
                                        Vencimento
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                        {new Date(charge.due_date).toLocaleDateString()}
                                    </p>
                                </div>

                                {isPaid && (
                                    <div className="relative animate-fade-in">
                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                                        <p className="text-xs font-bold text-emerald-700">Liquidado</p>
                                        <p className="text-[10px] text-gray-400">
                                            {new Date(charge.paid_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Manual Payment Modal (Preserved Functionality) */}
            {paymentModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-scale-in">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">Confirmar Pagamento Manual</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={paymentData.method}
                                    onChange={e => setPaymentData({ ...paymentData, method: e.target.value })}
                                >
                                    <option value="pix">Pix</option>
                                    <option value="boleto">Boleto Bancário</option>
                                    <option value="credit_card">Cartão de Crédito</option>
                                    <option value="debit_card">Cartão de Débito</option>
                                    <option value="cash">Dinheiro / Espécie</option>
                                    <option value="transfer">Transferência Bancária</option>
                                </select>
                            </div>

                            <Input
                                label="Data do Pagamento"
                                type="date"
                                value={paymentData.date}
                                onChange={e => setPaymentData({ ...paymentData, date: e.target.value })}
                            />

                            <Input
                                label="Observações (Opcional)"
                                placeholder="Ex: Pago na secretaria com Marcelo"
                                value={paymentData.obs}
                                onChange={e => setPaymentData({ ...paymentData, obs: e.target.value })}
                            />

                            <div className="flex gap-3 pt-4">
                                <Button variant="ghost" className="flex-1" onClick={() => setPaymentModalOpen(false)}>Cancelar</Button>
                                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200" onClick={handleMarkAsPaid}>
                                    Confirmar Baixa
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Negotiation Modal */}
            {negotiationModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-scale-in">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
                                <Percent className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Negociar Valor</h2>
                                <p className="text-xs text-gray-500">Aplique descontos ou correções</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Type Toggle */}
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setNegotiationData({ ...negotiationData, type: 'discount' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${negotiationData.type === 'discount' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <TrendingDown className="w-4 h-4" /> Desconto
                                </button>
                                <button
                                    onClick={() => setNegotiationData({ ...negotiationData, type: 'surcharge' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${negotiationData.type === 'surcharge' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <TrendingUp className="w-4 h-4" /> Acréscimo
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Modo</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                        value={negotiationData.mode}
                                        onChange={e => setNegotiationData({ ...negotiationData, mode: e.target.value })}
                                    >
                                        <option value="fixed">Valor Fixo (R$)</option>
                                        <option value="percent">Porcentagem (%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
                                        {negotiationData.mode === 'fixed' ? 'Valor (R$)' : 'Porcentagem (%)'}
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="0,00"
                                        value={negotiationData.value}
                                        onChange={e => setNegotiationData({ ...negotiationData, value: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Valor Atual:</span>
                                    <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.original_value || charge.value)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-gray-200">
                                    <span className="text-gray-900 font-bold">Novo Valor:</span>
                                    <span className={`font-bold text-lg ${negotiationData.type === 'discount' ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {(() => {
                                            const original = Number(charge.original_value || charge.value);
                                            const adjust = Number(negotiationData.value);
                                            let final = original;
                                            if (negotiationData.type === 'discount') {
                                                final = negotiationData.mode === 'fixed' ? original - adjust : original - (original * adjust / 100);
                                            } else {
                                                final = negotiationData.mode === 'fixed' ? original + adjust : original + (original * adjust / 100);
                                            }
                                            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(final);
                                        })()}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Motivo / Observação</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 h-20 resize-none"
                                    placeholder="Ex: Desconto de irmão, atraso justificado..."
                                    value={negotiationData.notes}
                                    onChange={e => setNegotiationData({ ...negotiationData, notes: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="ghost" className="flex-1" onClick={() => setNegotiationModalOpen(false)}>Cancelar</Button>
                                <Button className="flex-1 bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-200" onClick={handleNegotiationSave}>
                                    Aplicar {negotiationData.type === 'discount' ? 'Desconto' : 'Acréscimo'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Date Edit Modal */}
            {dateEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-scale-in">
                        <h2 className="text-lg font-bold mb-4 text-gray-900">Alterar {dateEditData.label}</h2>
                        <div className="space-y-4">
                            <Input
                                type="date"
                                value={dateEditData.value}
                                onChange={e => setDateEditData({ ...dateEditData, value: e.target.value })}
                            />
                            <div className="flex gap-3">
                                <Button variant="ghost" className="flex-1" onClick={() => setDateEditModalOpen(false)}>Cancelar</Button>
                                <Button className="flex-1 bg-brand-600 text-white" onClick={handleDateSave}>Salvar</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
