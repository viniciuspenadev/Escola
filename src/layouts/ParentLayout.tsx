import { useState, useRef, useEffect, type FC } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
    Home, CreditCard, GraduationCap, Calendar, BookOpen,
    User, LogOut, ChevronDown, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStudent } from '../contexts/StudentContext';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { useUnreadCommunications } from '../hooks/useUnreadCommunications';

export const ParentLayout: FC = () => {
    const { user, signOut } = useAuth();
    const { students, selectedStudent, setSelectedStudent, loading: studentsLoading } = useStudent();
    const { unreadCount } = useUnreadCommunications();
    const location = useLocation();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return <Navigate to="/login" replace />;

    const navItems = [
        { path: '/pais/home', icon: Home, label: 'Início', badge: unreadCount },
        { path: '/pais/diario', icon: BookOpen, label: 'Diário' },
        { path: '/pais/agenda', icon: Calendar, label: 'Agenda' },
        { path: '/pais/boletim', icon: GraduationCap, label: 'Boletim' },
        { path: '/pais/financeiro', icon: CreditCard, label: 'Financeiro' },
    ];

    const isActive = (path: string) => location.pathname.startsWith(path);

    return (
        <div className="h-[100dvh] bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative">
            {/* Header (App Bar) */}
            <header className="bg-brand-600 text-white px-5 py-4 pt-safe-area flex justify-between items-center sticky top-0 z-20 shadow-md">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Student Selector Dropdown */}
                    <div className="relative flex-1 min-w-0" ref={dropdownRef}>
                        <button
                            onClick={() => !studentsLoading && setDropdownOpen(!dropdownOpen)}
                            disabled={studentsLoading || students.length === 0}
                            className="w-full flex items-center gap-3 hover:bg-white/10 rounded-xl p-2 transition-all disabled:opacity-50"
                        >
                            {/* Avatar */}
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30 shrink-0 overflow-hidden">
                                {selectedStudent?.photo_url ? (
                                    <img
                                        src={selectedStudent.photo_url}
                                        alt={selectedStudent.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <User className="w-5 h-5 text-white" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-xs text-brand-100 font-medium">Olá, {user.name || 'Responsável'}</p>
                                <h1 className="text-sm font-bold truncate">
                                    {studentsLoading ? 'Carregando...' : selectedStudent?.name || 'Sem alunos'}
                                </h1>
                                {selectedStudent && (
                                    <p className="text-xs text-brand-200 mt-0.5">
                                        {selectedStudent.class_name && `${selectedStudent.class_name} • `}
                                        {selectedStudent.academic_year}
                                    </p>
                                )}
                            </div>

                            {/* Chevron (only show if multiple students) */}
                            {students.length > 1 && (
                                <ChevronDown
                                    className={`w-4 h-4 transition-transform shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`}
                                />
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {dropdownOpen && students.length > 1 && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-slide-down">
                                <div className="p-2 max-h-[320px] overflow-y-auto">
                                    {students.map((student) => {
                                        const isSelected = selectedStudent?.id === student.id;
                                        return (
                                            <button
                                                key={student.id}
                                                onClick={() => {
                                                    setSelectedStudent(student);
                                                    setDropdownOpen(false);
                                                }}
                                                className={`
                                                    w-full flex items-center gap-3 p-3 rounded-xl transition-all
                                                    ${isSelected
                                                        ? 'bg-brand-50 border-2 border-brand-500'
                                                        : 'hover:bg-gray-50 border-2 border-transparent hover:scale-[1.02]'
                                                    }
                                                `}
                                            >
                                                {/* Avatar */}
                                                <div className={`
                                                    w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden
                                                    ${isSelected ? 'ring-2 ring-brand-500 ring-offset-2' : 'bg-gray-100'}
                                                `}>
                                                    {student.photo_url ? (
                                                        <img
                                                            src={student.photo_url}
                                                            alt={student.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <User className="w-6 h-6 text-gray-400" />
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0 text-left">
                                                    <h3 className={`font-bold text-sm truncate ${isSelected ? 'text-brand-700' : 'text-gray-900'}`}>
                                                        {student.name}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {student.class_name && `${student.class_name}`}
                                                        {student.class_name && student.age && ' • '}
                                                        {student.age && `${student.age} anos`}
                                                        {!student.class_name && !student.age && 'Aluno'}
                                                    </p>
                                                </div>

                                                {/* Check Icon */}
                                                {isSelected && (
                                                    <Check className="w-5 h-5 text-brand-600 shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <NotificationCenter />
                    <button onClick={signOut} className="p-2 hover:bg-white/10 rounded-full">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className={`flex-1 overflow-y-auto pb-24 scrollbar-hide ${location.pathname.includes('/mural/') ? 'p-0' : 'px-4 py-6'}`}>
                <Outlet />
            </main>

            {/* Bottom Navigation (TabBar) */}
            <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-xl border-t border-gray-200/50 pb-safe-area z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around items-center h-16">
                    {navItems.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {active && (
                                    <div className="absolute top-0 w-12 h-1 bg-brand-500 rounded-b-full shadow-[0_2px_8px_rgba(99,102,241,0.5)] animate-pulse" />
                                )}

                                <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-brand-50/50 -translate-y-1' : 'bg-transparent'}`}>
                                    <item.icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                                </div>
                                <span className={`text-[10px] font-bold mt-0.5 ${active ? 'scale-105' : 'scale-100'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};
