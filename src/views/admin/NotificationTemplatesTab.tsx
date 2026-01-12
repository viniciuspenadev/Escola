import { type FC, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Card, Button, Input } from '../../components/ui';
import { Save, Loader2, Info, Edit2, X } from 'lucide-react';

interface Template {
    key: string;
    title_template: string;
    message_template: string;
    variables_description: string;
}

export const NotificationTemplatesTab: FC = () => {
    const { addToast } = useToast();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Template>>({});

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('wpp_notification_templates')
                .select('*')
                .order('key');
            if (error) throw error;
            setTemplates(data || []);
        } catch (error: any) {
            console.error('Error fetching templates:', error);
            addToast('error', 'Erro ao carregar modelos');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (template: Template) => {
        setEditingKey(template.key);
        setEditForm({ ...template });
    };

    const handleCancel = () => {
        setEditingKey(null);
        setEditForm({});
    };

    const handleSave = async (key: string) => {
        if (!editForm.title_template || !editForm.message_template) {
            addToast('error', 'Título e Mensagem são obrigatórios');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('wpp_notification_templates')
                .update({
                    title_template: editForm.title_template,
                    message_template: editForm.message_template,
                    updated_at: new Date().toISOString()
                })
                .eq('key', key);

            if (error) throw error;

            addToast('success', 'Modelo atualizado com sucesso!');
            setEditingKey(null);
            fetchTemplates(); // Refresh to ensure sync
        } catch (error: any) {
            console.error('Error saving template:', error);
            addToast('error', 'Erro ao salvar modelo: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const getHumanReadableName = (key: string) => {
        const map: Record<string, string> = {
            'diary_update': 'Agenda / Diário Escolar',
            'finance_new_bill': 'Financeiro: Nova Mensalidade',
            'finance_paid': 'Financeiro: Pagamento Confirmado',
            'occurrence_created': 'Ocorrência: Novo Registro'
        };
        return map[key] || key;
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Personalizar Mensagens</h2>
                    <p className="text-sm text-gray-500">Edite os textos que são enviados automaticamente pelo WhatsApp.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {templates.map((template) => (
                    <Card key={template.key} className={`p-6 border transition-all ${editingKey === template.key ? 'ring-2 ring-brand-500 border-transparent shadow-lg' : 'border-gray-200 hover:border-brand-200'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    {getHumanReadableName(template.key)}
                                    <span className="text-xs font-mono font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                        {template.key}
                                    </span>
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    <Info className="w-3 h-3 inline mr-1" />
                                    {template.variables_description || 'Sem variáveis dinâmicas'}
                                </p>
                            </div>

                            {editingKey !== template.key && (
                                <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                                    <Edit2 className="w-4 h-4 mr-2" /> Editar
                                </Button>
                            )}
                        </div>

                        {editingKey === template.key ? (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Título (Cabeçalho)</label>
                                    <Input
                                        value={editForm.title_template || ''}
                                        onChange={e => setEditForm(prev => ({ ...prev, title_template: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mensagem (Corpo)</label>
                                    <textarea
                                        className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-y"
                                        value={editForm.message_template || ''}
                                        onChange={e => setEditForm(prev => ({ ...prev, message_template: e.target.value }))}
                                    />
                                    <p className="text-xs text-brand-600 mt-1">Use as variáveis descritas acima (ex: {'{{student_name}}'}) para personalizar.</p>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                                        <X className="w-4 h-4 mr-2" /> Cancelar
                                    </Button>
                                    <Button size="sm" onClick={() => handleSave(template.key)} disabled={saving} className="bg-brand-600 text-white">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Salvar Alterações
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                <p className="font-bold text-gray-800 text-sm mb-1">{template.title_template}</p>
                                <p className="text-gray-600 text-sm whitespace-pre-wrap">{template.message_template}</p>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
};
