
import { type FC, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    FileText,
    Users,
    Calendar,
    LogOut,
    Menu,
    X,
    School,
    Bell,
    DollarSign,
    ChevronDown,
    ChevronRight,
    Circle,
    GraduationCap,
    AlertTriangle,
    Settings
} from 'lucide-react'; import { useLocation } from 'react-router-dom';
import { Button } from './ui/Button';
import { useState } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
    user: any;
    onLogout: () => void;
}

export const AdminLayout: FC<AdminLayoutProps> = ({ children, user, onLogout }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Define nav items with role restrictions and grouping
    const allNavItems = [
        {
            section: 'Visão Geral', // Optional section title (can be hidden if first)
            items: [
                { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['*'] }
            ]
        },
        {
            section: 'Pedagógico',
            items: [
                { icon: Calendar, label: 'Agenda', path: '/agenda', roles: ['*'] }, // Moved up for importance
                { icon: GraduationCap, label: 'Turmas', path: '/turmas', roles: ['*'] },
                { icon: Users, label: 'Alunos', path: '/alunos', roles: ['ADMIN', 'SECRETARY', 'COORDINATOR'] },
                { icon: LayoutDashboard, label: 'Plano de Atividades', path: '/planejamento', roles: ['ADMIN', 'COORDINATOR', 'TEACHER'] },
                { icon: AlertTriangle, label: 'Gestão de Faltas', path: '/frequencia', roles: ['ADMIN', 'SECRETARY', 'COORDINATOR'] },
            ]
        },
        {
            section: 'Administrativo',
            items: [
                { icon: FileText, label: 'Matrículas', path: '/matriculas', roles: ['ADMIN', 'SECRETARY'] },
                {
                    icon: DollarSign,
                    label: 'Financeiro',
                    path: '/financeiro',
                    roles: ['ADMIN', 'SECRETARY'],
                    subItems: [
                        { label: 'Visão Geral', path: '/financeiro', end: true },
                        { label: 'Mensalidades', path: '/financeiro/recebiveis' },
                        { label: 'Contas a Pagar', path: '/financeiro/pagar' },
                        { label: 'Planos & Preços', path: '/financeiro/planos' },
                    ]
                }
            ]
        },
        {
            section: 'Sistema',
            items: [
                {
                    icon: Settings,
                    label: 'Configurações',
                    path: '/config',
                    roles: ['ADMIN', 'SECRETARY'],
                    subItems: [
                        { label: 'Geral', path: '/config/geral' },
                        { label: 'Catálogo de Matérias', path: '/config/materias' },
                        { label: 'Unidades / Escolas', path: '/config/unidades' },
                        { label: 'Ano Letivo', path: '/config/anos-letivos' },
                        { label: 'Usuários', path: '/usuarios' },
                    ]
                }
            ]
        }
    ];

    // Flatten and Filter nav items for state/rendering helper
    const filteredGroups = allNavItems.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (user.role === 'ADMIN' || user.role === 'SECRETARY') return true;
            return item.roles.includes('*') || item.roles.includes(user.role);
        })
    })).filter(group => group.items.length > 0);

    // Flat list for expanded menu logic helper (keeps original logic working)
    const flatNavItems = filteredGroups.flatMap(g => g.items);

    // State for expanded submenus - Initialize based on current path
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
        const initialState: Record<string, boolean> = {};
        flatNavItems.forEach(item => {
            if (item.subItems) {
                // Check if any sub-item is active
                const hasActiveSub = item.subItems.some(sub => sub.path === location.pathname);
                if (hasActiveSub) {
                    initialState[item.label] = true;
                }
            }
        });
        return initialState;
    });

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    const isActiveLink = (path: string) => location.pathname === path;
    const isParentActive = (item: any) => item.subItems?.some((sub: any) => isActiveLink(sub.path));

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full z-10 shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-center">
                    <img src="/logo_school.png" alt="Escola" className="w-32 h-auto object-contain" />
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {filteredGroups.map((group) => (
                        <div key={group.section} className="mb-2">
                            {/* Only show section label if NOT the first group (Visão Geral usually doesn't need label if at top) OR if explicit desired */}
                            {group.section !== 'Visão Geral' && (
                                <div className="px-4 py-2 mt-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {group.section}
                                </div>
                            )}

                            {group.items.map((item) => {
                                const hasSub = !!item.subItems;
                                const isExpanded = expandedMenus[item.label];
                                const active = isActiveLink(item.path) || isParentActive(item);

                                if (hasSub) {
                                    return (
                                        <div key={item.label} className="space-y-1 mb-1">
                                            <button
                                                onClick={() => toggleMenu(item.label)}
                                                className={`
                                                    w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                                                    ${active
                                                        ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100'
                                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <item.icon className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                                                    <span>{item.label}</span>
                                                </div>
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>

                                            <div
                                                className={`
                                                    pl-4 ml-4 space-y-1 border-l-2 border-slate-100 overflow-hidden transition-all duration-300 ease-in-out
                                                    ${isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}
                                                `}
                                            >
                                                {item.subItems?.map((sub: any) => (
                                                    <NavLink
                                                        key={sub.path}
                                                        to={sub.path}
                                                        end={sub.end}
                                                        className={({ isActive }) => `
                                                            flex items-center gap-2 py-2 px-3 text-sm rounded-lg transition-colors
                                                            ${isActive
                                                                ? 'text-brand-700 font-medium bg-brand-50'
                                                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                                            }
                                                        `}
                                                    >
                                                        {({ isActive }) => (
                                                            <>
                                                                {isActive ? <Circle className="w-2 h-2 fill-current" /> : <div className="w-2" />}
                                                                {sub.label}
                                                            </>
                                                        )}
                                                    </NavLink>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => `
                                            flex items-center gap-3 px-4 py-2.5 mb-1 rounded-xl transition-all font-medium text-sm border border-transparent
                                            ${isActive
                                                ? 'bg-white text-brand-700 shadow-sm border-brand-100 bg-gradient-to-r from-white to-brand-50'
                                                : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                                            }
                                        `}
                                    >
                                        <item.icon className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                                        {item.label}
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-white">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-xs border border-brand-200">
                            {user?.name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{user?.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={onLogout}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sair
                    </Button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-20 px-4 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white">
                        <School className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-900">Escola V2</span>
                </div>
                <button onClick={toggleMobileMenu} className="p-2 text-slate-600">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 bg-slate-900/50 z-30" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="bg-white w-64 h-full shadow-xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
                        <nav className="space-y-2 mt-16">
                            {flatNavItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm
                                        ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}
                                    `}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>
                        <div className="mt-auto pt-4 border-t">
                            <p className="text-sm font-medium px-4 mb-2">{user?.name}</p>
                            <Button variant="ghost" className="w-full justify-start text-red-600" onClick={onLogout}>
                                <LogOut className="w-4 h-4 mr-2" /> Sair
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 min-h-screen flex flex-col pt-14 md:pt-0">

                {/* Desktop Top Bar (Hidden on mobile) */}
                <header className="hidden md:flex justify-end items-center h-16 bg-white border-b border-gray-200 px-8 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="w-full flex-1 p-4 md:p-8 animate-fade-in mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};
