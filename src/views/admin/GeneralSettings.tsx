import { type FC, useState, useEffect } from 'react';
import { Save, Clock, Info } from 'lucide-react';
import { supabase } from '../../services/supabase';



export const GeneralSettings: FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [diaryTime, setDiaryTime] = useState('17:00');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'diary_release_time')
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                setDiaryTime(data.value);
            }
        } catch (err) {
            console.error('Error loading settings:', err);
            setMessage({ type: 'error', text: 'Erro ao carregar configurações.' });
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
                    key: 'diary_release_time',
                    value: diaryTime,
                    description: 'Horário de liberação do diário diário para os pais',
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });

            // Auto hide message
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            console.error('Error saving settings:', err);
            setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Configurações Gerais</h1>
                    <p className="text-gray-600">Gerencie comportamentos globais do aplicativo.</p>
                </div>
            </div>

            {/* Notification Banner */}
            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                    <Info className="w-5 h-5" />
                    {message.text}
                </div>
            )}

            {/* Diary Settings Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-5 h-5 text-brand-600" />
                        <h2 className="font-semibold text-gray-900">Diário Digital</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                        Controle quando as informações diárias são disponibilizadas para os pais.
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="max-w-md">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Horário de Divulgação
                        </label>
                        <div className="flex gap-4 items-center">
                            <input
                                type="time"
                                value={diaryTime}
                                onChange={(e) => setDiaryTime(e.target.value)}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border"
                            />
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Salvando...' : 'Salvar Alteração'}
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            O resumo do dia e o diário de hoje ficarão ocultos para os pais até este horário.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
