import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, CreditCard, Clock,
    MessageCircle, Settings, LogOut, User,
    ChevronRight,
    GraduationCap,
    BookOpen,
    type LucideIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface MenuItem {
    label: string;
    icon: LucideIcon;
    path?: string;
    disabled?: boolean;
    badge?: string;
}

interface MenuGroup {
    title: string;
    items: MenuItem[];
}

export const ParentMenu: FC = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    const menuGroups: MenuGroup[] = [
        {
            title: 'Acadêmico',
            items: [
                { label: 'Cronograma', icon: Clock, path: '/pais/cronograma' },
                { label: 'Agenda', icon: Calendar, path: '/pais/agenda' },
                { label: 'Diário de Classe', icon: BookOpen, path: '/pais/diario' },
                { label: 'Boletim', icon: GraduationCap, path: '/pais/boletim', disabled: true, badge: 'Em breve' },
            ]
        },
        {
            title: 'Comunicação',

            items: [
                { label: 'Comunicados', icon: MessageCircle, path: '/pais/comunicados' },
            ]
        },
        {
            title: 'Financeiro',
            items: [
                { label: 'Financeiro', icon: CreditCard, path: '/pais/financeiro' },
            ]
        },
        {
            title: 'Configurações',
            items: [
                { label: 'Perfil do Aluno', icon: User, path: '/pais/perfil', disabled: true },
                { label: 'Ajustes do App', icon: Settings, path: '/pais/configuracoes', disabled: true },
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-24 animate-fade-in">
            <div className="bg-brand-600 text-white p-6 pt-8 rounded-b-[2.5rem] shadow-lg mb-6">
                <h1 className="text-2xl font-bold">Menu Completo</h1>
                <p className="text-brand-100 opacity-80">Acesso rápido a todas as funcionalidades</p>
            </div>

            <div className="px-4 space-y-6">
                {menuGroups.map((group, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100/50 overflow-hidden">
                        <h3 className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {group.title}
                        </h3>
                        <div className="flex flex-col">
                            {group.items.map((item, itemIdx) => (
                                <button
                                    key={itemIdx}
                                    onClick={() => item.path && !item.disabled && navigate(item.path)}
                                    disabled={item.disabled}
                                    className={`
                                        flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left
                                        ${itemIdx !== group.items.length - 1 ? 'border-b border-gray-50' : ''}
                                        ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'active:bg-gray-100'}
                                    `}
                                >
                                    <div className={`
                                        w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                                        ${item.disabled ? 'bg-gray-100 text-gray-400' : 'bg-brand-50 text-brand-600'}
                                    `}>
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <span className={`font-medium ${item.disabled ? 'text-gray-400' : 'text-gray-900'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    {item.badge && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                            {item.badge}
                                        </span>
                                    )}
                                    {!item.disabled && !item.badge && (
                                        <ChevronRight className="w-4 h-4 text-gray-300" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                <button
                    onClick={signOut}
                    className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sair da Conta
                </button>

                <p className="text-center text-xs text-gray-400 py-4">
                    Versão 2.1.0 (Build 2026.01)
                </p>
            </div>
        </div>
    );
};
