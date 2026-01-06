import { type FC, memo } from 'react';
import { ChevronDown } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DiaryCardProps {
    report: any; // Using any for now to match the parent types easily
    isExpanded: boolean;
    onToggle: (id: string) => void;
    isLocked?: boolean;
    releaseTime?: string;
}

export const DiaryCard: FC<DiaryCardProps> = memo(({ report, isExpanded, onToggle, isLocked = false, releaseTime = '17:00' }) => {
    const reportDate = new Date(report.date + 'T00:00:00');
    const isAbsent = report.attendance_status === 'absent';
    const dateStr = isValid(reportDate)
        ? format(reportDate, "EEEE, d 'de' MMMM", { locale: ptBR })
        : 'Data inválida';

    // Helper for summary
    const getCardSummary = (r: any) => {
        if (isLocked) return `🔒 Disponível após as ${releaseTime}h`;
        if (r.homework) return `📚 ${r.homework.split('\n')[0].substring(0, 40)}...`;
        if (r.activities) return `🎨 ${r.activities.split('\n')[0].substring(0, 40)}...`;
        if (r.observations) return `📝 ${r.observations.split('\n')[0].substring(0, 40)}...`;
        if (r.routine_data?.mood) return `😊 Humor: ${r.routine_data.mood}`;
        return 'Sem detalhes adicionais';
    };

    const summary = getCardSummary(report);
    const hasContent = report.homework || report.activities || report.observations;

    return (
        <div
            onClick={() => !isLocked && onToggle(report.id)}
            className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${isExpanded ? 'ring-2 ring-brand-500' : ''
                } ${isLocked ? 'opacity-75 bg-gray-50' : ''}`}
        >
            {/* Collapsed Header */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-gray-700 capitalize flex-1">
                        {dateStr}
                    </h2>
                    <div className="flex items-center gap-2">
                        {/* Attendance Badge */}
                        {report.attendance_status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${report.attendance_status === 'present' ? 'bg-green-100 text-green-700' :
                                report.attendance_status === 'absent' ? 'bg-red-100 text-red-700' :
                                    report.attendance_status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-blue-100 text-blue-700'
                                }`}>
                                {report.attendance_status === 'present' ? '✅' :
                                    report.attendance_status === 'absent' ? '❌' :
                                        report.attendance_status === 'late' ? '⏰' : '📋'}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''
                            } ${isLocked ? 'opacity-0' : ''}`} />
                    </div>
                </div>

                {!isExpanded && (
                    <p className="text-sm text-gray-600 truncate">
                        {summary}
                    </p>
                )}
            </div>

            {/* Expanded Content */}
            {isExpanded && !isLocked && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4 animate-fade-in">
                    {/* Attendance Detail */}
                    {report.attendance_status && (
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">✓</span>
                                <span className="font-semibold text-gray-900">Presença</span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${report.attendance_status === 'present' ? 'bg-green-100 text-green-700' :
                                report.attendance_status === 'absent' ? 'bg-red-100 text-red-700' :
                                    report.attendance_status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-blue-100 text-blue-700'
                                }`}>
                                {report.attendance_status === 'present' ? '✅ Presente' :
                                    report.attendance_status === 'absent' ? '❌ Faltou' :
                                        report.attendance_status === 'late' ? '⏰ Atrasado' :
                                            '📋 Justificado'}
                            </span>
                        </div>
                    )}

                    {/* Activities - Always Valid to show what happened in class */}
                    {report.activities && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🎨</span>
                                <h3 className="font-semibold text-gray-900">Atividades do Dia</h3>
                            </div>
                            <p className="text-gray-700 text-sm ml-7 whitespace-pre-wrap">
                                {report.activities}
                            </p>
                        </div>
                    )}

                    {/* Homework - Always Valid (parents need to know) */}
                    {report.homework && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📚</span>
                                <h3 className="font-semibold text-gray-900">Lição de Casa</h3>
                            </div>
                            <p className="text-gray-700 text-sm ml-7 whitespace-pre-wrap">
                                {report.homework}
                            </p>
                        </div>
                    )}

                    {/* Personal Details - Hide if Absent */}
                    {!isAbsent && (
                        <>
                            {/* Observations */}
                            {report.observations && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">📝</span>
                                        <h3 className="font-semibold text-gray-900">Observações</h3>
                                    </div>
                                    <p className="text-gray-700 text-sm ml-7 whitespace-pre-wrap">
                                        {report.observations}
                                    </p>
                                </div>
                            )}

                            {/* Routine */}
                            {report.routine_data && Object.keys(report.routine_data).length > 0 && (
                                <div className="border-t border-gray-100 pt-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-lg">👶</span>
                                        <h3 className="font-semibold text-gray-900">Rotina</h3>
                                    </div>
                                    <div className="ml-7 space-y-2 text-sm">
                                        {report.routine_data.meals && (
                                            <div className="bg-orange-50 rounded-lg p-3">
                                                <div className="font-medium text-gray-700 mb-1">🍽️ Alimentação</div>
                                                {report.routine_data.meals.lunch && <div className="text-gray-600 text-xs">• Almoço: {report.routine_data.meals.lunch}</div>}
                                                {report.routine_data.meals.snack && <div className="text-gray-600 text-xs">• Lanche: {report.routine_data.meals.snack}</div>}
                                                {report.routine_data.meals.breakfast && <div className="text-gray-600 text-xs">• Café: {report.routine_data.meals.breakfast}</div>}
                                            </div>
                                        )}
                                        {report.routine_data.sleep && (
                                            <div className="bg-indigo-50 rounded-lg p-3">
                                                <div className="font-medium text-gray-700 mb-1">😴 Sono</div>
                                                {report.routine_data.sleep.nap && <div className="text-gray-600 text-xs">• Soneca: {report.routine_data.sleep.nap}</div>}
                                                {report.routine_data.sleep.duration && <div className="text-gray-600 text-xs">• Duração: {report.routine_data.sleep.duration}</div>}
                                            </div>
                                        )}
                                        {report.routine_data.hygiene && (
                                            <div className="bg-green-50 rounded-lg p-3">
                                                <div className="font-medium text-gray-700 mb-1">🚿 Higiene</div>
                                                {report.routine_data.hygiene.status && <div className="text-gray-600 text-xs">• Status: {report.routine_data.hygiene.status}</div>}
                                                {report.routine_data.hygiene.diapers && <div className="text-gray-600 text-xs">• Trocas: {report.routine_data.hygiene.diapers}x</div>}
                                            </div>
                                        )}
                                        {report.routine_data.mood && (
                                            <div className="bg-yellow-50 rounded-lg p-3">
                                                <div className="font-medium text-gray-700 mb-1">😊 Humor</div>
                                                <div className="text-gray-600 text-xs">{report.routine_data.mood}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {!hasContent && !report.routine_data && (
                        <p className="text-center text-gray-400 text-sm py-4">
                            Sem registros detalhados para este dia
                        </p>
                    )}
                </div>
            )}
        </div>
    );
});

export const DiarySkeleton: FC = () => {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-5 bg-gray-100 rounded-full w-8"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-5 bg-gray-100 rounded-full w-8"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-5 bg-gray-100 rounded-full w-8"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-3/4"></div>
            </div>
        </div>
    )
}
