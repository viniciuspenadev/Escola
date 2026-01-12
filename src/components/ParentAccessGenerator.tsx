import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Button, Input, Card } from './ui';
import { useToast } from '../contexts/ToastContext';
import { Loader2, Copy, Send, CheckCircle, UserPlus, Lock } from 'lucide-react';

interface ParentAccessGeneratorProps {
    studentId: string;
    studentName: string;
    responsibleEmail?: string;
    responsibleName?: string;
    onClose?: () => void;
    onSuccess?: () => void;
}

export const ParentAccessGenerator = ({
    studentId,
    studentName,
    responsibleEmail = '',
    responsibleName = 'Responsável',
    onClose,
    onSuccess
}: ParentAccessGeneratorProps) => {
    const { addToast } = useToast();
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        email: responsibleEmail,
        password: '', // Will auto-generate if empty? No, better explicit.
        name: responsibleName
    });

    // Auto-generate a strong but readable password
    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, l
        let pass = 'Escola';
        for (let i = 0; i < 4; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData(prev => ({ ...prev, password: pass }));
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Create a TEMPORARY Client to sign up the parent
            // ensuring we don't log out the current admin
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseKey) throw new Error("Missing Env Vars");

            const tempClient = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: false, // Don't save to localStorage
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // 2. Sign Up Parent
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        role: 'PARENT'
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Falha ao criar usuário (sem dados retornados).");

            // 3. Link to Student (Using Admin Session via Main Client)
            const { error: linkError } = await supabase.rpc('admin_add_guardian', {
                p_student_id: studentId,
                p_guardian_id: authData.user.id,
                p_relationship: 'financial_responsible' // Must match check constraint
            });

            if (linkError) throw linkError;

            // Success!
            addToast('success', 'Acesso criado com sucesso!');
            setStep('success');
            onSuccess?.(); // Notify parent component

        } catch (err: any) {
            console.error(err);
            addToast('error', 'Erro: ' + (err.message || 'Falha desconhecida'));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        const text = `*Acesso ao Portal do Aluno* 🎓\n\nOlá, segue seu acesso para acompanhar o aluno *${studentName}*:\n\n🔗 Link: https://escola-app.com/login (Exemplo)\n📧 Email: ${formData.email}\n🔑 Senha: ${formData.password}`;
        navigator.clipboard.writeText(text);
        addToast('success', 'Credenciais copiadas!');
    };

    const sendWhatsapp = () => {
        const text = `Olá! Segue seu acesso ao Portal do Aluno para acompanhar *${studentName}*:%0A%0A📧 Login: ${formData.email}%0A🔑 Senha: ${formData.password}%0A%0AAcesse em: [Link do App]`;
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    if (step === 'success') {
        return (
            <div className="p-6 bg-green-50 rounded-xl border border-green-100 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Acesso Criado!</h3>
                    <p className="text-sm text-gray-600">O cadastro foi realizado e vinculado ao aluno.</p>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 text-left space-y-2 relative group">
                    <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">Email</span>
                        <p className="font-mono text-gray-800">{formData.email}</p>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">Senha Provisória</span>
                        <p className="font-mono text-gray-800 font-bold">{formData.password}</p>
                    </div>
                    <button onClick={copyToClipboard} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-50 rounded-lg transition-colors">
                        <Copy className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex gap-2">
                    <Button onClick={sendWhatsapp} className="flex-1 bg-green-600 hover:bg-green-700">
                        <Send className="w-4 h-4 mr-2" /> Enviar Whats
                    </Button>
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Fechar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-600" />
                Gerar Acesso Manual
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700">Email do Responsável</label>
                    <Input
                        type="email"
                        required
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemplo.com"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700 flex justify-between">
                        Senha Inicial
                        <button type="button" onClick={generatePassword} className="text-xs text-brand-600 hover:align-baseline">Gerar Automática</button>
                    </label>
                    <div className="relative">
                        <Input
                            type="text"
                            required
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Defina uma senha"
                        />
                        <Lock className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                    </div>
                </div>

                <div className="pt-2 flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 bg-brand-600" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                        Criar e Vincular
                    </Button>
                </div>
            </form>
        </Card>
    );
};
