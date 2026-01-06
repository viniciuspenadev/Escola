
import { type FC } from 'react';
import { EnrollmentFunnel } from '../components/dashboard/EnrollmentFunnel';
import { TaskWidget } from '../components/dashboard/TaskWidget';
import { NextEvents } from '../components/dashboard/NextEvents';
import { AttendanceChart } from '../components/dashboard/AttendanceChart';
import { StudentMoodChart } from '../components/dashboard/StudentMoodChart';
import { Users, Megaphone, Plus, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';

export const DashboardView: FC = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Painel de Controle</h1>
                    <p className="text-sm text-gray-500 mt-1">Visão geral da escola.</p>
                </div>

                {/* Compact Quick Actions */}
                <div className="flex items-center gap-3">
                    <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-brand-600 transition-colors text-xs font-medium h-9 px-4"
                        onClick={() => navigate('/comunicados')}
                    >
                        <Megaphone className="w-4 h-4 mr-2" />
                        Comunicado
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-brand-600 transition-colors text-xs font-medium h-9 px-4"
                        onClick={() => navigate('/alunos')}
                    >
                        <Users className="w-4 h-4 mr-2" />
                        Aluno
                    </Button>
                    <div className="h-6 w-px bg-gray-200 mx-1"></div>
                    <Button
                        size="sm"
                        className="bg-brand-600 text-white hover:bg-brand-700 shadow-sm border-transparent text-xs font-medium h-9 px-4"
                        onClick={() => navigate('/matriculas/nova')}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Matrícula
                    </Button>
                    <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border-transparent text-xs font-medium h-9 px-4"
                        onClick={() => navigate('/financeiro/novo')}
                    >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Cobrança
                    </Button>
                </div>
            </div>

            {/* 1. KEY METRIC: Enrollment Pipeline (Top Priority as requested) */}
            <div>
                <EnrollmentFunnel />
            </div>

            {/* 2. Operational Layer: Tasks & Events */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Tasks (2/3) */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider pl-1">Minhas Tarefas</h3>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[400px]">
                        <TaskWidget />
                    </div>
                </div>

                {/* Events (1/3) */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider pl-1">Próximos Eventos</h3>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-fit">
                        <NextEvents />
                    </div>
                </div>
            </div>

            {/* 3. Pedagogical Indicators (Bottom) */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider pl-1">Indicadores Pedagógicos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AttendanceChart />
                    <StudentMoodChart />
                </div>
            </div>
        </div>
    );
};

