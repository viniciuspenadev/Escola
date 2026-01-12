import { type FC, useState, useEffect } from 'react';
import { Save, Building2, MapPin, Phone, Globe, Info, School } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui';

interface SchoolInfo {
    name: string;
    address: string;
    phone: string;
    website: string;
    logo_url: string;
}

export const SchoolInfoSettings: FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [info, setInfo] = useState<SchoolInfo>({
        name: '',
        address: '',
        phone: '',
        website: '',
        logo_url: ''
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'school_info')
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.value) {
                // Parse if string, otherwise assume JSON
                const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                setInfo({
                    name: parsed.name || '',
                    address: parsed.address || '',
                    phone: parsed.phone || '',
                    website: parsed.website || '',
                    logo_url: parsed.logo_url || ''
                });
            }
        } catch (err) {
            console.error('Error loading school info:', err);
            setMessage({ type: 'error', text: 'Erro ao carregar dados da escola.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'school_info',
                    value: info,
                    description: 'Informações gerais da escola (Nome, Endereço, Logo)',
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Dados da escola atualizados com sucesso!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            console.error('Error saving school info:', err);
            setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando dados...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            {/* Header Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-1">
                        <School className="w-5 h-5 text-brand-600" />
                        <h2 className="font-semibold text-gray-900">Identidade da Escola</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                        Essas informações aparecem no cabeçalho dos documentos, faturas e mensagens automáticas (WhatsApp).
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Feedback Message */}
                    {message && (
                        <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            <Info className="w-5 h-5" />
                            {message.text}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Nome da Escola */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome da Instituição
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Building2 className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={info.name}
                                    onChange={(e) => setInfo(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Colégio Futuro"
                                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Usado no cabeçalho das mensagens do WhatsApp.</p>
                        </div>

                        {/* Endereço */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Endereço Completo
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPin className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={info.address}
                                    onChange={(e) => setInfo(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF"
                                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                        </div>

                        {/* Telefone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Telefone de Contato
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={info.phone}
                                    onChange={(e) => setInfo(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="(11) 99999-9999"
                                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                        </div>

                        {/* Website */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Website / Portal
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Globe className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={info.website}
                                    onChange={(e) => setInfo(prev => ({ ...prev, website: e.target.value }))}
                                    placeholder="www.suaescola.com.br"
                                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-brand-600 text-white min-w-[150px]"
                        >
                            {saving ? (
                                <>
                                    <Save className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Salvar Alterações
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
