import { type FC, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Card, Button, Input } from '../../components/ui';
import { Save, Loader2, DollarSign, Calendar, AlertTriangle, CheckCircle, CreditCard, Lock, Key } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export interface FinanceConfig {
    enable_new_bill: boolean;
    enable_payment_confirmation: boolean;
    enable_due_reminder: boolean;
    days_before_due: number;
    enable_overdue_warning: boolean;
    days_after_due: number;
    cron_time: string; // HH:MM
}

export interface GatewayConfig {
    provider: 'asaas' | 'manual';
    environment: 'sandbox' | 'production';
    api_key: string;
    wallet_id?: string;
}

export const FinancialSettingsTab: FC = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Default Configs
    const [notificationConfig, setNotificationConfig] = useState<FinanceConfig>({
        enable_new_bill: true,
        enable_payment_confirmation: true,
        enable_due_reminder: false,
        days_before_due: 1,
        enable_overdue_warning: false,
        days_after_due: 3,
        cron_time: '09:00'
    });

    const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig>({
        provider: 'manual',
        environment: 'sandbox',
        api_key: ''
    });

    useEffect(() => {
        fetchAllConfigs();
    }, []);

    const fetchAllConfigs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['finance_notification_config', 'finance_gateway_config']);

            if (error) throw error;

            data?.forEach(item => {
                let val = item.value;
                if (typeof val === 'string') {
                    try { val = JSON.parse(val); } catch (e) { /* ignore */ }
                }

                if (item.key === 'finance_notification_config') {
                    // Safe merge
                    setNotificationConfig(prev => ({ ...prev, ...val }));
                }
                if (item.key === 'finance_gateway_config') {
                    setGatewayConfig(prev => ({ ...prev, ...val }));
                }
            });

        } catch (error) {
            console.error('Error fetching configs:', error);
            addToast('error', 'Erro ao carregar configurações');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Upsert Notification Config
            const { error: error1 } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'finance_notification_config',
                    value: notificationConfig,
                    description: 'Configurações de Notificações Financeiras',
                    updated_at: new Date().toISOString()
                });

            if (error1) throw error1;

            // Upsert Gateway Config
            const { error: error2 } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'finance_gateway_config',
                    value: gatewayConfig,
                    description: 'Configuração do Gateway de Pagamento (Asaas)',
                    updated_at: new Date().toISOString()
                });

            if (error2) throw error2;

            addToast('success', 'Todas as configurações foram salvas!');
        } catch (error: any) {
            console.error('Error saving:', error);
            addToast('error', 'Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Configurações Financeiras</h2>
                    <p className="text-sm text-gray-500">Gerencie automação, notificações e integração bancária.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-brand-600 text-white shadow-sm hover:bg-brand-700">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Alterações
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* --- GATEWAY CONFIG --- */}
                <Card className="p-6 border-l-4 border-l-brand-600 shadow-sm lg:col-span-2">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-brand-600" />
                                Gateway de Pagamento
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Configure o processador de pagamentos (Pix/Boleto).</p>
                        </div>
                        <div className="px-3 py-1 bg-brand-50 text-brand-700 text-xs font-bold rounded uppercase tracking-wider">
                            Recomendado: Asaas
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Provedor</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                value={gatewayConfig.provider}
                                onChange={e => setGatewayConfig({ ...gatewayConfig, provider: e.target.value as any })}
                            >
                                <option value="manual">Manual (Sem integração)</option>
                                <option value="asaas">Asaas (Pix + Boleto)</option>
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                {gatewayConfig.provider === 'asaas'
                                    ? 'Permite gerar cobranças automáticas e receber via Pix/Boleto.'
                                    : 'Você precisará dar baixa manualmente nos pagamentos.'}
                            </p>
                        </div>

                        {gatewayConfig.provider === 'asaas' && (
                            <div className="animate-fade-in space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="env"
                                                checked={gatewayConfig.environment === 'sandbox'}
                                                onChange={() => setGatewayConfig({ ...gatewayConfig, environment: 'sandbox' })}
                                                className="w-4 h-4 text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="text-sm text-gray-700">Sandbox (Teste)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="env"
                                                checked={gatewayConfig.environment === 'production'}
                                                onChange={() => setGatewayConfig({ ...gatewayConfig, environment: 'production' })}
                                                className="w-4 h-4 text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="text-sm text-gray-700">Produção</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                        <Key className="w-4 h-4 text-gray-400" />
                                        API Key do Asaas ({gatewayConfig.environment === 'sandbox' ? 'Sandbox' : 'Produção'})
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-mono text-gray-600"
                                            placeholder={`$aact_${gatewayConfig.environment === 'sandbox' ? 'test' : 'prod'}...`}
                                            value={gatewayConfig.api_key}
                                            onChange={e => setGatewayConfig({ ...gatewayConfig, api_key: e.target.value })}
                                        />
                                        <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Acesse o <a href="https://www.asaas.com/" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Painel do Asaas</a> {'>'} Configurações {'>'} Integrações para gerar sua chave.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* --- NOTIFICATIONS CONFIG --- */}
                <Card className="p-6 border-l-4 border-l-blue-500 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                        Gatilhos Imediatos
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">Ações automáticas ao interagir como Admin.</p>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-900">Nova Cobrança Disponível</p>
                                <p className="text-xs text-gray-500">Ao marcar uma parcela como "Publicada".</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationConfig.enable_new_bill}
                                    onChange={e => setNotificationConfig({ ...notificationConfig, enable_new_bill: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-900">Confirmação de Pagamento</p>
                                <p className="text-xs text-gray-500">Ao dar baixa (receber) uma parcela.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationConfig.enable_payment_confirmation}
                                    onChange={e => setNotificationConfig({ ...notificationConfig, enable_payment_confirmation: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-orange-500 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-orange-600" />
                            Cobranças Automáticas
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Horário:</span>
                            <Input
                                type="time"
                                className="w-24 h-8 text-center text-sm"
                                value={notificationConfig.cron_time || '09:00'}
                                onChange={e => setNotificationConfig({ ...notificationConfig, cron_time: e.target.value })}
                            />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">O sistema enviará lembretes automaticamente.</p>

                    <div className="space-y-6">
                        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <p className="font-medium text-gray-900">Lembrete de Vencimento</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={notificationConfig.enable_due_reminder}
                                        onChange={e => setNotificationConfig({ ...notificationConfig, enable_due_reminder: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>

                            {notificationConfig.enable_due_reminder && (
                                <div className="animate-fade-in pl-6 flex items-center gap-3">
                                    <span className="text-sm text-gray-600">Enviar</span>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={30}
                                        className="w-16 h-8 text-center"
                                        value={notificationConfig.days_before_due}
                                        onChange={e => setNotificationConfig({ ...notificationConfig, days_before_due: parseInt(e.target.value) || 1 })}
                                    />
                                    <span className="text-sm text-gray-600">dias <b>ANTES</b>.</span>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    <p className="font-medium text-gray-900">Aviso de Atraso</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={notificationConfig.enable_overdue_warning}
                                        onChange={e => setNotificationConfig({ ...notificationConfig, enable_overdue_warning: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>

                            {notificationConfig.enable_overdue_warning && (
                                <div className="animate-fade-in pl-6 flex items-center gap-3">
                                    <span className="text-sm text-gray-600">Enviar</span>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={30}
                                        className="w-16 h-8 text-center"
                                        value={notificationConfig.days_after_due}
                                        onChange={e => setNotificationConfig({ ...notificationConfig, days_after_due: parseInt(e.target.value) || 1 })}
                                    />
                                    <span className="text-sm text-gray-600">dias <b>DEPOIS</b>.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
