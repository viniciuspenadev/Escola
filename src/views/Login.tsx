import { useState, type FormEvent, type FC } from 'react';
import { MOCK_USERS } from '../constants';
import type { User } from '../types';
import { supabase } from '../services/supabase';
import { Button, Input } from '../components/ui';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { Loader2, Mail, Lock } from 'lucide-react';

interface LoginProps {
    onLogin: (user: User) => void;
    onPublicEnrollment: () => void;
}

export const Login: FC<LoginProps> = ({ onLogin }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts([...toasts, { id, message, type }]);
        setTimeout(() => removeToast(id), 3000);
    };

    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        if (!email || !password) return addToast('Preencha email e senha', 'error');

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            addToast('Login realizado com sucesso!', 'success');
        } catch (error: any) {
            addToast(error.message || 'Erro ao fazer login', 'error');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-gray-50 font-sans">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Left Side: Login Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 xl:p-24 relative bg-white">
                <div className="w-full max-w-sm space-y-8 animate-fade-in-up">

                    {/* Header with Logo */}
                    <div className="text-center">
                        <img
                            src="/logo_school.png"
                            alt="Logo Escola"
                            className="h-24 mx-auto mb-6 object-contain"
                        />
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                            Bem-vindo
                        </h2>
                        <p className="mt-2 text-sm text-gray-500">
                            Digite suas credenciais para acessar o portal.
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            icon={<Mail className="w-4 h-4 text-gray-400" />}
                            className="py-2.5"
                        />
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={<Lock className="w-4 h-4 text-gray-400" />}
                                className="py-2.5"
                            />
                        </div>

                        <Button className="w-full py-6 text-base font-semibold bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all hover:translate-y-[-1px]">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
                        </Button>
                    </form>

                </div>

                {/* Footer Copyright */}
                <div className="absolute bottom-6 text-xs text-gray-300">
                    &copy; 2025 Portal Escolar. Todos os direitos reservados.
                </div>
            </div>

            {/* Right Side: Visuals */}
            <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-brand-900">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-brand-900/90 to-brand-800/80"></div>
                <div className="relative z-10 h-full flex flex-col justify-center items-center text-center p-12 text-white">
                    <img
                        src="/logo_school.png"
                        alt="Logo"
                        className="h-32 mb-8 opacity-90 drop-shadow-2xl brightness-0 invert"
                    />
                    <h1 className="text-4xl font-bold mb-6 max-w-lg leading-tight">
                        Transformando futuros com educação de excelência.
                    </h1>
                    <p className="text-lg text-brand-100 max-w-md leading-relaxed">
                        Acompanhe o desenvolvimento do seu filho em tempo real, com segurança e transparência.
                    </p>
                </div>
            </div>

            {/* Demo Shortcut */}
            <div className="fixed bottom-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
                <div className="flex gap-1 bg-white p-1 rounded-full shadow-lg border">
                    {MOCK_USERS.slice(0, 3).map(u => (
                        <button key={u.id} onClick={() => onLogin(u)} className="w-6 h-6 rounded-full overflow-hidden border border-gray-200" title={u.role}>
                            <img src={u.avatar_url} alt={u.role} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
