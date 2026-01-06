import { type FC, useState, useEffect, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DiaryCard, DiarySkeleton } from './DiaryCard';
import { useStudent } from '../../contexts/StudentContext';
import { useAppSettings } from '../../hooks/useAppSettings';

interface DailyReport {
    id: string;
    date: string;
    homework?: string;
    activities?: string;
    observations?: string;
    attendance_status?: 'present' | 'absent' | 'late' | 'justified';
    routine_data?: {
        meals?: {
            lunch?: string;
            snack?: string;
            breakfast?: string;
        };
        sleep?: {
            nap?: string;
            duration?: string;
        };
        hygiene?: {
            status?: string;
            diapers?: number;
        };
        mood?: string;
    };
    student_id?: string;
}

type PeriodType = 'today' | 'week' | 'month';

export const ParentDiary: FC = () => {
    const { selectedStudent } = useStudent();
    const { value: releaseTime } = useAppSettings('diary_release_time', '17:00');
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<PeriodType>('week');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!selectedStudent) return;
        fetchReports();
    }, [period, selectedStudent]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const { startDate, endDate } = getDateRange(period);

            if (!selectedStudent) return;

            // Strict Filter: Only for the selected student
            // Strict Filter: Only within the active academic year of enrollment
            const academicYear = selectedStudent.academic_year; // e.g., 2025

            // Ensure our date range doesn't exceed the academic year boundaries
            // If the user asks for "Month", and that month is in 2026 but the enrollment is 2025,
            // we should probably respect the period but IF the user means "don't show old stuff from 2024", 
            // the academic year filter handles that logic if mapped correctly.
            // However, the prompt says "pull only from the school year of that active enrollment".

            // Just strictly filtering by student ID is step 1 (critical).
            let query = supabase
                .from('daily_reports')
                .select('*')
                .eq('student_id', selectedStudent.id) // FIX: Restrict to specific student
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });

            // Optional: If we want to strictly enforce year boundary (user request):
            if (academicYear) {
                const startOfYear = `${academicYear}-01-01`;
                const endOfYear = `${academicYear}-12-31`;

                // We intersect the period range with the academic year range
                // But generally, just filtering by student_id and letting the period drive the view is standard.
                // UNLESS the student has data in 2024 and 2025 with the SAME student_id?
                // If student_id is persistent, then `year` filter is needed if the UI allows browsing back to 2024.
                // But here period is 'today','week','month'. 
                // Using the academicYear to enforce boundary:
                query = query.gte('date', startOfYear).lte('date', endOfYear);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Fetch attendance separately and merge
            const studentIds = data?.map(r => r.student_id) || [];
            // Handle edge case where no reports found, still might want attendance, 
            // but for diary focus we usually show existing report entries or create stubs.
            // For now, let's keep logic attached to existing reports or found attendance. 
            // FIXME: Ideally we should fetch all days and merge both ways, but keeping scope tight.

            let reportsWithAttendance = [...(data || [])];

            if (studentIds.length > 0) {
                const { data: attendanceData } = await supabase
                    .from('student_attendance')
                    .select(`
                        student_id,
                        status,
                        sheet:class_attendance_sheets!inner(date)
                    `)
                    .in('student_id', studentIds)
                    .gte('sheet.date', startDate)
                    .lte('sheet.date', endDate);

                // Merge attendance into reports
                reportsWithAttendance = reportsWithAttendance.map(report => {
                    const attendance = attendanceData?.find(
                        (a: any) => a.sheet?.date === report.date && a.student_id === report.student_id
                    );
                    return {
                        ...report,
                        attendance_status: attendance?.status
                    };
                });
            }

            setReports(reportsWithAttendance);

        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const getDateRange = (periodType: PeriodType) => {
        const now = new Date();
        let startDate: string;
        let endDate: string;

        switch (periodType) {
            case 'today':
                startDate = format(now, 'yyyy-MM-dd');
                endDate = startDate;
                break;
            case 'week':
                startDate = format(startOfWeek(now, { locale: ptBR }), 'yyyy-MM-dd');
                endDate = format(endOfWeek(now, { locale: ptBR }), 'yyyy-MM-dd');
                break;
            case 'month':
                startDate = format(startOfMonth(now), 'yyyy-MM-dd');
                endDate = format(endOfMonth(now), 'yyyy-MM-dd');
                break;
        }

        return { startDate, endDate };
    };

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds(prev => {
            const newExpanded = new Set(prev);
            if (newExpanded.has(id)) {
                newExpanded.delete(id);
            } else {
                newExpanded.add(id);
            }
            return newExpanded;
        });
    }, []);

    const getPeriodLabel = () => {
        switch (period) {
            case 'today': return 'Hoje';
            case 'week': return 'Esta Semana';
            case 'month': return 'Este Mês';
        }
    };

    // Calculate visible reports (filtering out locked today's report)
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const todayStr = format(now, 'yyyy-MM-dd');
    const isTodayLocked = currentTime < releaseTime;

    const visibleReports = reports.filter(r => {
        if (r.date === todayStr && isTodayLocked) return false;
        return true;
    });

    const totalPresent = visibleReports.filter(r => r.attendance_status === 'present').length;
    const totalWithHomework = visibleReports.filter(r => r.homework).length;
    const totalWithObs = visibleReports.filter(r => r.observations).length;

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
            {/* Header - Always Visible */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-brand-600" />
                    Diário de Classe
                </h1>
                <p className="text-gray-600 text-sm">Acompanhe o dia a dia do seu filho</p>


            </div>

            {/* Segmented Control for Period - Always Visible */}
            <div className="bg-gray-100 p-1 rounded-xl flex items-center justify-between relative">
                {(['today', 'week', 'month'] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${period === p
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
                    </button>
                ))}
            </div>

            {/* Content Area - Shows Skeleton or Real Content */}
            {loading ? (
                <DiarySkeleton />
            ) : (
                <>
                    {/* Sticky Summary Banner */}
                    {visibleReports.length > 0 && (
                        <div className="bg-white/90 backdrop-blur-md border border-gray-100 rounded-xl p-4 shadow-sm sticky top-2 z-20 ring-1 ring-black/5 animate-slide-in">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                                <span>📊 Resumo - {getPeriodLabel()}</span>
                                <span className="bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full text-[10px]">{visibleReports.length} registros</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-green-50/50 rounded-lg p-3 border border-green-100 flex flex-col items-center justify-center text-center">
                                    <span className="text-xl font-bold text-green-700">{totalPresent}</span>
                                    <span className="text-[10px] uppercase font-bold text-green-600/70 mt-0.5">Presenças</span>
                                </div>
                                <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 flex flex-col items-center justify-center text-center">
                                    <span className="text-xl font-bold text-blue-700">{totalWithHomework}</span>
                                    <span className="text-[10px] uppercase font-bold text-blue-600/70 mt-0.5">Lições</span>
                                </div>
                                <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100 flex flex-col items-center justify-center text-center">
                                    <span className="text-xl font-bold text-amber-700">{totalWithObs}</span>
                                    <span className="text-[10px] uppercase font-bold text-amber-600/70 mt-0.5">Obs.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timeline */}
                    {visibleReports.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <BookOpen className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Nenhum registro
                            </h3>
                            <p className="text-gray-500 text-sm max-w-[200px] mx-auto">
                                O professor ainda não preencheu o diário para {getPeriodLabel().toLowerCase()}.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {visibleReports.map((report) => (
                                <DiaryCard
                                    key={report.id}
                                    report={report}
                                    isExpanded={expandedIds.has(report.id)}
                                    onToggle={toggleExpand}
                                    isLocked={false} // Already filtered out if locked
                                    releaseTime={releaseTime}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
