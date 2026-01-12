import { type FC, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../../services/supabase';
import { useStudent } from '../../contexts/StudentContext';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LessonPlan } from '../../types';
import { planningService } from '../../services/planningService';

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

import { useSystem } from '../../contexts/SystemContext';

export const ParentSchedule: FC = () => {
    const { selectedStudent } = useStudent();
    const { currentYear } = useSystem();
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<LessonPlan[]>([]);
    const [className, setClassName] = useState('');
    const [currentDate, setCurrentDate] = useState(() => {
        const date = new Date();
        const day = date.getDay();
        // If Saturday (6) or Sunday (0), advance to Monday
        if (day === 6) date.setDate(date.getDate() + 2);
        if (day === 0) date.setDate(date.getDate() + 1);
        return date;
    });

    useEffect(() => {
        if (!selectedStudent || !currentYear) return;
        fetchSchedule();
    }, [selectedStudent, currentYear, currentDate]); // Reload when date changes

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const targetYear = selectedStudent?.academic_year || new Date().getFullYear();

            // 1. Get Class
            const { data: enrollment } = await supabase
                .from('class_enrollments')
                .select('class_id, class:classes!inner(name, school_year)')
                .eq('student_id', selectedStudent?.id)
                .eq('class.status', 'active')
                .eq('class.school_year', targetYear)
                .limit(1)
                .maybeSingle();

            if (!enrollment) {
                setLoading(false);
                return;
            }

            setClassName((enrollment.class as any)?.name || '');

            // 2. Calculate Week Range (Mon-Fri) based on currentDate
            const baseDate = new Date(currentDate);
            const day = baseDate.getDay() || 7;
            const start = new Date(baseDate);
            if (day !== 1) start.setHours(-24 * (day - 1)); // Back to Monday

            const end = new Date(start);
            end.setDate(end.getDate() + 4); // Friday

            const startStr = format(start, 'yyyy-MM-dd');
            const endStr = format(end, 'yyyy-MM-dd');

            // 3. Get Lesson Plans
            const data = await planningService.getLessonPlans(enrollment.class_id, startStr, endStr);
            setPlans(data);

        } catch (error) {
            console.error('Error fetching schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPlansForDay = (dayIndex: number) => { // 1 = Mon, 2 = Tue...
        const baseDate = new Date(currentDate);
        const currentDay = baseDate.getDay() || 7;
        const targetDate = new Date(baseDate);
        // Adjust date to match the target day of the week within the currently selected week
        targetDate.setDate(baseDate.getDate() - (currentDay - dayIndex));

        const dateStr = format(targetDate, 'yyyy-MM-dd');
        return plans.filter(p => p.date === dateStr);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando cronograma...</div>;

    if (!className) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
                <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Sem turma associada</h2>
                <p className="text-gray-500">
                    O aluno ainda não foi enturmado. Entre em contato com a secretaria.
                </p>
            </div>
        );
    }

    // Days 1 (Mon) to 5 (Fri)
    const displayDays = [1, 2, 3, 4, 5];

    return (
        <div className="space-y-6 animate-fade-in pb-24 px-4 pt-4">
            <header className="mb-6">
                <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-8 h-8 text-brand-600" />
                            Planejamento Semanal
                        </h1>
                        <p className="text-gray-500">
                            Aulas para <span className="font-bold text-brand-600">{className}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                        <button
                            onClick={() => {
                                const newDate = new Date(currentDate);
                                newDate.setDate(newDate.getDate() - 7);
                                setCurrentDate(newDate);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-brand-600 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
                            {(() => {
                                const start = new Date(currentDate);
                                const day = start.getDay() || 7;
                                if (day !== 1) start.setHours(-24 * (day - 1));
                                const end = new Date(start);
                                end.setDate(end.getDate() + 4);
                                return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
                            })()}
                        </span>
                        <button
                            onClick={() => {
                                const newDate = new Date(currentDate);
                                newDate.setDate(newDate.getDate() + 7);
                                setCurrentDate(newDate);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-brand-600 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="space-y-6">
                {displayDays.map(dayIndex => {
                    const dayPlans = getPlansForDay(dayIndex);
                    const isToday = new Date().getDay() === dayIndex;

                    return (
                        <div key={dayIndex} className={`rounded-2xl border overflow-hidden ${isToday ? 'border-brand-300 shadow-md ring-1 ring-brand-100' : 'border-gray-200 bg-white'}`}>
                            <div className={`px-4 py-3 border-b flex justify-between items-center ${isToday ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-100'}`}>
                                <h3 className={`font-bold ${isToday ? 'text-brand-700' : 'text-gray-700'}`}>
                                    {WEEKDAYS[dayIndex]}
                                </h3>
                                {isToday && <span className="text-[10px] font-bold bg-brand-200 text-brand-800 px-2 py-0.5 rounded-full uppercase">Hoje</span>}
                            </div>

                            <div className="divide-y divide-gray-100 bg-white">
                                {dayPlans.length === 0 ? (
                                    <div className="p-4 text-center text-gray-400 text-sm italic">
                                        Nenhuma aula planejada
                                    </div>
                                ) : (
                                    dayPlans.map(plan => (
                                        <div key={plan.id} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors group relative">
                                            {/* Time Column */}
                                            <div className="flex flex-col items-end min-w-[60px] pt-1">
                                                <span className="text-lg font-bold text-gray-900 leading-none">{plan.start_time.slice(0, 5)}</span>
                                                <span className="text-xs text-gray-400 mt-1">{plan.end_time.slice(0, 5)}</span>
                                            </div>

                                            {/* Timeline Line/Dot */}
                                            <div className="relative flex flex-col items-center">
                                                <div className={`w-3 h-3 rounded-full border-2 mt-2 z-10 bg-white ${plan.status === 'cancelled' ? 'border-red-400' : 'border-brand-400 group-hover:bg-brand-400 group-hover:scale-125 transition-all'}`}></div>
                                                <div className="w-px h-full bg-gray-100 absolute top-3 -z-0"></div>
                                            </div>

                                            {/* Content Column */}
                                            <div className="flex-1 pb-4">
                                                <div className="flex flex-col items-start gap-1">
                                                    {/* Subject Badge - Now Larger and colorful */}
                                                    <span className={`
                                                        px-3 py-1 rounded-lg text-sm font-bold border flex items-center gap-2 shadow-sm
                                                        ${plan.subject?.color || 'bg-gray-100 text-gray-700 border-gray-200'}
                                                    `}>
                                                        <span>{plan.subject?.emoji}</span>
                                                        {plan.subject?.name}
                                                    </span>

                                                    {/* Topic */}
                                                    {plan.topic ? (
                                                        <h4 className="text-base text-gray-700 mt-1 leading-snug">
                                                            {plan.topic}
                                                        </h4>
                                                    ) : (
                                                        <span className="text-sm text-gray-400 italic mt-1">Sem tópico registrado</span>
                                                    )}
                                                </div>

                                                {/* Status pill */}
                                                {plan.status === 'cancelled' && (
                                                    <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        Aula Cancelada
                                                    </div>
                                                )}

                                                {/* Homework Box */}
                                                {plan.homework && (
                                                    <div className="mt-3 relative bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-100 rounded-xl p-3 flex gap-3">
                                                        <div className="bg-white p-1.5 rounded-lg shadow-sm border border-orange-100 h-fit">
                                                            <span className="text-lg">🏠</span>
                                                        </div>
                                                        <div>
                                                            <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-0.5">Para Casa</h5>
                                                            <p className="text-sm text-gray-800">{plan.homework}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div >
    );
};
