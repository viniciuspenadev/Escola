import { useState, type FormEvent, type FC } from 'react';
import { MOCK_USERS } from '../constants';
import type { User } from '../types';
import { supabase } from '../services/supabase';

import { ToastContainer, type ToastMessage } from '../components/Toast';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
    onLogin: (user: User) => void;
    onPublicEnrollment: () => void;
}

export const Login: FC<LoginProps> = ({ onLogin }) => {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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
        <div className="h-[100dvh] flex bg-gray-50 font-sans overflow-hidden">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Left Side: Visuals */}
            <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-brand-900 shadow-2xl z-20">
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

            {/* Right Side: Login Form (Using card design from Login-test.tsx) */}
            <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 relative z-10">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden mb-12 text-center animate-fade-in">
                        <img
                            src="/logo_school.png"
                            alt="Logo Escola"
                            className="h-20 mx-auto"
                        />
                    </div>

                    {/* Form Card */}
                    <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 lg:p-10 border border-white animate-slide-up">
                        <div className="mb-10 text-center lg:text-left">
                            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Entrar</h2>
                            <p className="text-gray-500 font-medium">Acesse o Portal da Família</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            {/* Email Input */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 ml-1">
                                    E-mail de acesso
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 border border-gray-100 rounded-2xl bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all duration-300 font-medium"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 ml-1">
                                    Sua senha
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-12 pr-12 py-3.5 border border-gray-100 rounded-2xl bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all duration-300 font-medium"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-brand-600 transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                                <div className="flex justify-end">
                                    <button type="button" className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">
                                        Esqueceu a senha?
                                    </button>
                                </div>
                            </div>

                            {/* Login Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-brand-200 hover:shadow-brand-300 hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Entrando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Entrar no Portal</span>
                                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-10 pt-8 border-t border-gray-50 text-center">
                            <p className="text-xs text-gray-400 font-medium">
                                &copy; 2026 Plataforma Escolar. Todos os direitos reservados.
                            </p>
                        </div>
                    </div>
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
