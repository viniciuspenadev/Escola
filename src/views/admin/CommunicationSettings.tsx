import { type FC, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Button, Card, Input } from '../../components/ui';
import { Save, MessageSquare, AlertCircle, Wifi, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { NotificationTemplatesTab } from './NotificationTemplatesTab';
import { FinancialSettingsTab } from './FinancialSettingsTab';

interface CommunicationSettingsProps {
    embedded?: boolean;
}

export const CommunicationSettings: FC<CommunicationSettingsProps> = ({ embedded = false }) => {
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'disconnected' | 'error'>('idle');

    // Tab State
    const [activeTab, setActiveTab] = useState<'connection' | 'finance' | 'templates'>('connection');

    // Config State
    const [config, setConfig] = useState({
        url: '',
        apikey: '',
        instance: '',
        enabled_channels: {
            finance: true,
            diary: false,
            occurrence: true
        }
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'whatsapp_config')
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.value) {
                console.log('Raw config from DB:', data.value);

                // Handle potential double-serialization (string inside JSONB)
                let incoming = data.value;
                if (typeof incoming === 'string') {
                    try {
                        incoming = JSON.parse(incoming);
                    } catch (e) {
                        console.error('Failed to parse config string:', e);
                    }
                }

                // Sanitize and extract only expected keys
                setConfig(prev => ({
                    ...prev,
                    url: incoming.url || prev.url,
                    apikey: incoming.apikey || prev.apikey,
                    instance: incoming.instance || prev.instance,
                    enabled_channels: {
                        finance: incoming.enabled_channels?.finance ?? prev.enabled_channels.finance,
                        diary: incoming.enabled_channels?.diary ?? prev.enabled_channels.diary,
                        occurrence: incoming.enabled_channels?.occurrence ?? prev.enabled_channels.occurrence
                    }
                }));
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            addToast('error', 'Erro ao carregar configurações');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'whatsapp_config',
                    value: config,
                    description: 'Configurações de conexão Evolution API',
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            addToast('success', 'Configurações salvas com sucesso!');
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao salvar: ' + (error as any).message);
        } finally {
            setSaving(false);
        }
    };

    const toggleChannel = (channel: 'finance' | 'diary' | 'occurrence') => {
        setConfig(prev => ({
            ...prev,
            enabled_channels: {
                ...prev.enabled_channels,
                [channel]: !prev.enabled_channels[channel]
            }
        }));
    };

    const handleTestNotification = async (channel: 'diary' | 'finance' | 'occurrence') => {
        addToast('info', 'Iniciando teste em massa para TODOS os alunos...');

        try {
            // 1. Buscando todos os alunos ativos
            const { data: students, error: fetchError } = await supabase
                .from('students')
                .select('id, name')
                .eq('status', 'active');

            if (fetchError) throw fetchError;
            if (!students?.length) {
                addToast('error', 'Nenhum aluno ativo encontrado.');
                return;
            }

            let sentCount = 0;

            // 2. Disparando para todos
            await Promise.all(students.map(async (student) => {
                try {
                    const { error } = await supabase.functions.invoke('send-whatsapp', {
                        body: {
                            record: {
                                id: `TEST-MASS-${Date.now()}-${student.id}`,
                                user_id: '123e4567-e89b-12d3-a456-426614174000', // Hardcoded valid UUID
                                type: channel,
                                title: 'Teste de Notificação',
                                message: `Olá! Teste de notificação para o aluno(a) ${student.name}.`,
                                data: { student_id: student.id }
                            }
                        }
                    });
                    if (error) throw error;
                    sentCount++;
                } catch (e) {
                    console.error(`Erro ao enviar para ${student.name}`, e);
                }
            }));

            addToast('success', `Enviado com sucesso para ${sentCount} alunos!`);

        } catch (err) {
            console.error('Erro no teste massivo:', err);
            addToast('error', 'Falha no teste: ' + (err as any).message);
        }
    };

    const testConnection = async () => {
        if (!config.url || !config.instance || !config.apikey) {
            addToast('error', 'Preencha URL, Instance e API Key para testar.');
            return;
        }

        setConnectionStatus('checking');
        try {
            const baseUrl = config.url.replace(/\/$/, '');
            const endpoint = `${baseUrl}/instance/connectionState/${config.instance}`;

            console.log('Testing connection to:', endpoint);

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'apikey': config.apikey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error('API Key inválida');
                if (response.status === 404) throw new Error('Instância não encontrada');
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('Connection state:', data);

            if (data?.instance?.state === 'open' || data?.state === 'open') {
                setConnectionStatus('connected');
                addToast('success', 'Conexão estabelecida com sucesso! (WhatsApp Logado)');
            } else if (data?.instance?.state === 'close' || data?.state === 'close') {
                setConnectionStatus('disconnected');
                addToast('error', 'Atenção: Conexão feita, mas o WhatsApp está DESCONECTADO (QrCode pendente).');
            } else {
                setConnectionStatus('connected');
                addToast('success', 'API acessível!');
            }

        } catch (error) {
            console.error('Connection test failed:', error);
            setConnectionStatus('error');
            addToast('error', 'Falha na conexão: ' + (error as any).message + '. Verifique CORS ou URL.');
        }
    };

    return (
        <div className={`space-y-6 animate-fade-in ${embedded ? '' : 'pb-20'}`}>
            {!embedded && (
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações de Comunicação</h1>
                    <p className="text-gray-500">Gerencie integrações, canais e personalize as mensagens enviadas.</p>
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('connection')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'connection'
                        ? 'border-brand-600 text-brand-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Conexão & Status
                </button>
                <button
                    onClick={() => setActiveTab('finance')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'finance'
                        ? 'border-brand-600 text-brand-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Automação Financeira
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'templates'
                        ? 'border-brand-600 text-brand-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Modelos de Texto
                </button>
            </div>

            {/* Tab Content: Connection & Rules */}
            {activeTab === 'connection' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Evolution API Connection Card */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-green-600" />
                                Conexão WhatsApp (Evolution API)
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL da API</label>
                                    <Input
                                        placeholder="https://evolution.seudominio.com"
                                        value={config.url}
                                        onChange={e => setConfig({ ...config, url: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Endereço base da sua instância Evolution.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Global API Key</label>
                                        <Input
                                            type="password"
                                            placeholder="Sua chave de segurança"
                                            value={config.apikey}
                                            onChange={e => setConfig({ ...config, apikey: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Instância</label>
                                        <Input
                                            placeholder="ex: Escola"
                                            value={config.instance}
                                            onChange={e => setConfig({ ...config, instance: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t pt-4">
                                <div className="flex items-center gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={testConnection}
                                        disabled={connectionStatus === 'checking'}
                                        className="text-sm"
                                    >
                                        {connectionStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
                                        Testar Conexão
                                    </Button>

                                    <div className="text-sm">
                                        {connectionStatus === 'idle' && <span className="text-gray-500">Status não verificado</span>}
                                        {connectionStatus === 'checking' && <span className="text-blue-600">Verificando...</span>}
                                        {connectionStatus === 'connected' && <span className="text-green-600 font-medium flex items-center gap-1">● Conectado e Ativo</span>}
                                        {connectionStatus === 'disconnected' && <span className="text-orange-600 font-medium flex items-center gap-1">● API OK, WhatsApp Desconectado</span>}
                                        {connectionStatus === 'error' && <span className="text-red-600 font-medium flex items-center gap-1">● Erro de Conexão</span>}
                                    </div>
                                </div>

                                <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Salvar Configurações
                                </Button>
                            </div>
                        </Card>

                        {/* Channel Rules (Restored) */}
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Regras de Envio Automático</h2>
                            <p className="text-sm text-gray-500 mb-4">Escolha quais eventos do sistema devem disparar mensagens automáticas no WhatsApp dos responsáveis.</p>

                            <div className="space-y-4">
                                {/* Financeiro moved to dedicated tab, check Master Switch */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div>
                                        <p className="font-medium text-gray-900">Financeiro (Boletos e Cobranças)</p>
                                        <p className="text-xs text-gray-500">Master Switch: Envia lembretes e confirmações.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            size="sm" variant="ghost" className="text-xs h-7 text-blue-600"
                                            onClick={() => setActiveTab('finance')}
                                        >
                                            Detalhes &gt;
                                        </Button>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={config.enabled_channels?.finance ?? false} onChange={() => toggleChannel('finance')} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div>
                                        <p className="font-medium text-gray-900">Diário Escolar (Agenda)</p>
                                        <p className="text-xs text-gray-500">Avisos de tarefas, alimentação e rotina.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs px-2"
                                            onClick={() => handleTestNotification('diary')}
                                        >
                                            Testar Envio
                                        </Button>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={config.enabled_channels?.diary ?? false} onChange={() => toggleChannel('diary')} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div>
                                        <p className="font-medium text-gray-900">Ocorrências e Comportamento</p>
                                        <p className="text-xs text-gray-500">Notificações críticas que exigem atenção.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={config.enabled_channels?.occurrence ?? false} onChange={() => toggleChannel('occurrence')} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Sidebar Info/Logs */}
                    <div className="space-y-6">
                        <Card className="p-4 bg-blue-50 border-blue-100">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-blue-900">Como funciona?</h4>
                                    <p className="text-sm text-blue-700 mt-1">O sistema se conecta à sua instância privada da Evolution API. Certifique-se de que o aparelho celular está conectado e com bateria.</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* Tab Content: Finance Automation */}
            {activeTab === 'finance' && (
                <FinancialSettingsTab />
            )}

            {/* Tab Content: Notification Templates */}
            {activeTab === 'templates' && (
                <NotificationTemplatesTab />
            )}
        </div>
    );
};
