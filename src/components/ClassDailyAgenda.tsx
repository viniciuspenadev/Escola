
import { type FC, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Button } from './ui';
import { Loader2, Save, Sun, Moon, Utensils, BookOpen, AlertCircle, Check, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface ClassDailyAgendaProps {
    classId: string;
    date: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | null;

export const ClassDailyAgenda: FC<ClassDailyAgendaProps> = ({ classId, date }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data
    const [students, setStudents] = useState<any[]>([]);
    const [reportsMap, setReportsMap] = useState<Record<string, any>>({});
    const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
    const [statusMap, setStatusMap] = useState<Record<string, 'saved' | 'unsaved' | 'pending'>>({});

    // Batch Actions State
    const [batchHomework, setBatchHomework] = useState('');
    const [batchActivity, setBatchActivity] = useState('');

    useEffect(() => {
        fetchData();
    }, [classId, date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: roster, error: rosterError } = await supabase
                .from('class_enrollments')
                .select('student_id, student:students(id, name)')
                .eq('class_id', classId);

            if (rosterError) throw rosterError;

            const sorted = (roster || []).sort((a: any, b: any) =>
                (a.student?.name || '').localeCompare(b.student?.name || '')
            );
            setStudents(sorted);

            const { data: reports, error: reportsError } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('class_id', classId)
                .eq('date', date);

            if (reportsError) throw reportsError;

            const { data: attendanceData } = await supabase
                .from('class_attendance_sheets')
                .select('id, student_attendance(student_id, status)')
                .eq('class_id', classId)
                .eq('date', date)
                .single();

            const rMap: any = {};
            const existingReportIds = new Set();
            reports?.forEach((r) => {
                rMap[r.student_id] = { ...r, routine_data: r.routine_data || {} };
                existingReportIds.add(r.student_id);
            });

            const aMap: any = {};
            if (attendanceData && attendanceData.student_attendance) {
                attendanceData.student_attendance.forEach((a: any) => {
                    aMap[a.student_id] = a.status;
                });
            }

            const sMap: any = {};
            sorted.forEach((s: any) => {
                const hasReport = existingReportIds.has(s.student_id);
                sMap[s.student_id] = hasReport ? 'saved' : 'pending';

                if (!rMap[s.student_id]) {
                    rMap[s.student_id] = {
                        student_id: s.student_id,
                        routine_data: { meals: { lunch: '', snack: '' }, sleep: { nap: '' }, hygiene: '', mood: 'happy' },
                        homework: '', activities: '', observations: ''
                    };
                }
                // Explicit Attendance: If no record, stays undefined/null
                if (aMap[s.student_id] === undefined) {
                    aMap[s.student_id] = null;
                }
            });

            setReportsMap(rMap);
            setAttendanceMap(aMap);
            setStatusMap(sMap);

            if (reports && reports.length > 0) {
                setBatchHomework(reports[0].homework || '');
                setBatchActivity(reports[0].activities || '');
            } else {
                setBatchHomework('');
                setBatchActivity('');
            }

        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar diário.');
        } finally {
            setLoading(false);
        }
    };

    const updateReport = (studentId: string, field: string, value: any, isRoutineData = false) => {
        setReportsMap(prev => {
            const current = prev[studentId];
            let newData;
            if (isRoutineData) {
                if (field.includes('.')) {
                    const [parent, child] = field.split('.');
                    newData = {
                        ...current,
                        routine_data: {
                            ...current.routine_data,
                            [parent]: { ...(current.routine_data?.[parent] || {}), [child]: value }
                        }
                    };
                } else {
                    newData = {
                        ...current,
                        routine_data: { ...current.routine_data, [field]: value }
                    };
                }
            } else {
                newData = { ...current, [field]: value };
            }
            return { ...prev, [studentId]: newData };
        });
        setStatusMap(prev => ({ ...prev, [studentId]: 'unsaved' }));
    };

    const toggleAttendance = (studentId: string) => {
        setAttendanceMap(prev => {
            const current = prev[studentId];
            // Cycle: null -> present -> absent -> present
            let next: AttendanceStatus = 'present';
            if (current === 'present') next = 'absent';
            else if (current === 'absent') next = 'present';
            else next = 'present'; // From null/late to present

            return { ...prev, [studentId]: next };
        });
        setStatusMap(prev => ({ ...prev, [studentId]: 'unsaved' }));
    };

    const handleApplyBatch = () => {
        setReportsMap(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                next[key] = {
                    ...next[key],
                    homework: batchHomework,
                    activities: batchActivity
                };
            });
            return next;
        });
        setStatusMap(prev => {
            const next: any = {};
            Object.keys(prev).forEach(k => next[k] = 'unsaved');
            return next;
        });
        addToast('success', 'Conteúdo aplicado para todos.');
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const { data: sheetData } = await supabase
                .from('class_attendance_sheets')
                .select('id')
                .eq('class_id', classId)
                .eq('date', date)
                .single();

            let sheetId = sheetData?.id;
            if (!sheetId) {
                const { data: newSheet, error: createError } = await supabase
                    .from('class_attendance_sheets')
                    .insert({ class_id: classId, date })
                    .select()
                    .single();
                if (createError) throw createError;
                sheetId = newSheet.id;
            }

            const attendanceRecords = Object.keys(attendanceMap)
                .filter(id => attendanceMap[id] !== null) // Only save defined statuses
                .map(studentId => ({
                    sheet_id: sheetId,
                    student_id: studentId,
                    status: attendanceMap[studentId]
                }));

            const { error: attError } = await supabase
                .from('student_attendance')
                .upsert(attendanceRecords, { onConflict: 'sheet_id,student_id' });
            if (attError) throw attError;

            const reportData = Object.values(reportsMap).map((r: any) => ({
                class_id: classId,
                student_id: r.student_id,
                date: date,
                routine_data: r.routine_data,
                homework: r.homework,
                activities: r.activities,
                observations: r.observations
            }));

            const { error: repError } = await supabase
                .from('daily_reports')
                .upsert(reportData, { onConflict: 'student_id,date' });

            if (repError) throw repError;

            setStatusMap(prev => {
                const next: any = {};
                Object.keys(prev).forEach(k => next[k] = 'saved');
                return next;
            });

            addToast('success', 'Diário e Chamada salvos!');
        } catch (error: any) {
            console.error(error);
            addToast('error', error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Carregando diário...</p>
        </div>
    );

    const stats = {
        saved: Object.values(statusMap).filter(s => s === 'saved').length,
        unsaved: Object.values(statusMap).filter(s => s === 'unsaved').length,
        total: students.length
    };

    return (
        <div className="space-y-6">
            {/* Control Bar - Sticky */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm sticky top-4 z-20 backdrop-blur-sm bg-white/95">

                {/* Save Status / Actions */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-3 text-xs font-medium text-gray-500 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                        {stats.unsaved > 0 ? (
                            <span className="flex items-center gap-2 text-amber-600 font-bold animate-pulse">
                                <AlertCircle className="w-4 h-4" />
                                {stats.unsaved} alterações pendentes
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 text-green-600 font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                Tudo salvo
                            </span>
                        )}
                        <span className="w-px h-3 bg-gray-300 mx-1"></span>
                        <span>{stats.saved}/{stats.total} alunos</span>
                    </div>

                    <Button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className={`${stats.unsaved > 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-brand-600 hover:bg-brand-700"} text-white shadow-lg transition-all min-w-[160px]`}
                    >
                        {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        {stats.unsaved > 0 ? 'Salvar Alterações' : 'Salvar Tudo'}
                    </Button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-brand-600" />
                        Atividades Gerais da Turma
                    </h3>
                    <Button variant="ghost" className="text-xs text-brand-600 hover:bg-brand-50" onClick={handleApplyBatch} size="sm">
                        Aplicar para Todos
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Em Sala (Resumo)</label>
                        <textarea
                            className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none bg-gray-50 focus:bg-white"
                            rows={3}
                            placeholder="O que foi trabalhado hoje? Ex: Atividade de pintura..."
                            value={batchActivity}
                            onChange={(e) => setBatchActivity(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Para Casa</label>
                        <textarea
                            className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none bg-gray-50 focus:bg-white"
                            rows={3}
                            placeholder="Lição de casa ou recado..."
                            value={batchHomework}
                            onChange={(e) => setBatchHomework(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {students.map((item) => {
                    const r = reportsMap[item.student_id] || {};
                    const routine = r.routine_data || {};
                    const attStatus = attendanceMap[item.student_id];
                    const isPresent = attStatus === 'present' || attStatus === 'late';
                    const isPending = attStatus === null || attStatus === undefined;
                    const status = statusMap[item.student_id];

                    return (
                        <div key={item.student_id} className={`bg-white rounded-xl border transition-all duration-300
                            ${isPresent ? 'border-gray-200 shadow-sm hover:shadow-md' : ''}
                            ${!isPresent && !isPending ? 'border-red-100 bg-red-50/10 opacity-75' : ''}
                            ${isPending ? 'border-amber-200 bg-amber-50' : ''}
                        `}>
                            <div className="p-4 flex justify-between items-center border-b border-gray-50 bg-gray-50/50 rounded-t-xl">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase shadow-sm transition-colors ring-2 ring-white
                                        ${isPresent ? 'bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600' : ''}
                                        ${!isPresent && !isPending ? 'bg-red-100 text-red-400' : ''}
                                        ${isPending ? 'bg-amber-100 text-amber-600' : ''}
                                    `}>
                                        {item.student?.name?.substring(0, 2)}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold flex items-center gap-2 text-base
                                            ${isPresent ? 'text-gray-900' : ''}
                                            ${!isPresent && !isPending ? 'text-gray-400 line-through' : ''}
                                            ${isPending ? 'text-amber-800' : ''}
                                        `}>
                                            {item.student?.name}
                                            {status === 'saved' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-bold">Salvo</span>}
                                            {status === 'unsaved' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Alterado</span>}
                                        </h4>
                                        {!isPresent && !isPending && <span className="text-xs text-red-400 font-medium">Ausente</span>}
                                        {isPending && <span className="text-xs text-amber-600 font-medium flex items-center gap-1">Aguardando Chamada</span>}
                                    </div>
                                </div>

                                <button
                                    onClick={() => toggleAttendance(item.student_id)}
                                    className={`
                                        flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                                        ${isPresent ? 'bg-white border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200' : ''}
                                        ${!isPresent && !isPending ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
                                        ${isPending ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : ''}
                                    `}
                                    title={isPresent ? "Marcar como Falta" : "Marcar como Presente"}
                                >
                                    {isPresent && <><Trash2 className="w-3 h-3" /> Ausente?</>}
                                    {!isPresent && !isPending && <><Check className="w-3 h-3" /> Presente?</>}
                                    {isPending && <><AlertTriangle className="w-3 h-3" /> Confirmar</>}
                                </button>
                            </div>

                            {/* Logic: Show Routine fields ONLY if Present. Show Observations ALWAYS (unless Pending). */}
                            {!isPending && (
                                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">

                                    {/* Routine Section - Hidden if Absent */}
                                    {isPresent && (
                                        <div className="lg:col-span-12 xl:col-span-5 space-y-5 border-r border-gray-100 pr-5">
                                            {/* Mood Selector - Now nicer */}
                                            <div>
                                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                                                    <Sun className="w-3.5 h-3.5" /> Humor do Dia
                                                </label>
                                                <div className="flex gap-2">
                                                    {[
                                                        { label: 'Feliz', emoji: '😄', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
                                                        { label: 'Cansado', emoji: '😴', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
                                                        { label: 'Choroso', emoji: '😭', color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' },
                                                        { label: 'Doente', emoji: '🤒', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' }
                                                    ].map((mood) => (
                                                        <button
                                                            key={mood.label}
                                                            onClick={() => updateReport(item.student_id, 'mood', mood.label, true)}
                                                            className={`flex-1 py-2 px-1 rounded-lg text-sm border transition-all flex flex-col items-center gap-1
                                                                ${routine.mood === mood.label ? `ring-2 ring-offset-1 ring-brand-300 shadow-sm ${mood.color} font-bold` : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}
                                                            `}
                                                            title={mood.label}
                                                        >
                                                            <span className="text-xl">{mood.emoji}</span>
                                                            <span className="text-[10px] uppercase tracking-wide">{mood.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                                                        <Utensils className="w-3.5 h-3.5" /> Refições
                                                    </label>
                                                    <div className="space-y-2">
                                                        <select
                                                            className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 outline-none hover:bg-gray-100 transition-colors"
                                                            value={routine.meals?.lunch || ''}
                                                            onChange={(e) => updateReport(item.student_id, 'meals.lunch', e.target.value, true)}
                                                        >
                                                            <option value="" className="text-gray-400">Almoço...</option>
                                                            <option value="🥘 Comeu Tudo">🥘 Comeu Tudo</option>
                                                            <option value="🍛 Comeu Bem">🍛 Comeu Bem</option>
                                                            <option value="🥡 Comeu Pouco">🥡 Comeu Pouco</option>
                                                            <option value="❌ Recusou">❌ Recusou</option>
                                                        </select>
                                                        <select
                                                            className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 outline-none hover:bg-gray-100 transition-colors"
                                                            value={routine.meals?.snack || ''}
                                                            onChange={(e) => updateReport(item.student_id, 'meals.snack', e.target.value, true)}
                                                        >
                                                            <option value="" className="text-gray-400">Lanche...</option>
                                                            <option value="🍎 Aceitou Bem">🍎 Aceitou Bem</option>
                                                            <option value="🍪 Comeu Pouco">🍪 Comeu Pouco</option>
                                                            <option value="❌ Recusou">❌ Recusou</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                                                        <Moon className="w-3.5 h-3.5" /> Descanso
                                                    </label>
                                                    <select
                                                        className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 outline-none hover:bg-gray-100 transition-colors"
                                                        value={routine.sleep?.nap || ''}
                                                        onChange={(e) => updateReport(item.student_id, 'sleep.nap', e.target.value, true)}
                                                    >
                                                        <option value="" className="text-gray-400">Soneca...</option>
                                                        <option value="😴 Dormiu Bem">😴 Dormiu Bem</option>
                                                        <option value="🥴 Agitado">🥴 Agitado</option>
                                                        <option value="👀 Não Dormiu">👀 Não Dormiu</option>
                                                    </select>

                                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mt-2">
                                                        <Check className="w-3.5 h-3.5" /> Higiene
                                                    </label>
                                                    <select
                                                        className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 outline-none hover:bg-gray-100 transition-colors"
                                                        value={routine.hygiene || ''}
                                                        onChange={(e) => updateReport(item.student_id, 'hygiene', e.target.value, true)}
                                                    >
                                                        <option value="" className="text-gray-400">Status...</option>
                                                        <option value="✨ Normal">✨ Normal</option>
                                                        <option value="🧻 Troca Extra">🧻 Troca Extra</option>
                                                        <option value="⚠️ Irregular">⚠️ Irregular</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Observations Section - Always Visible if not Pending (even if Absent, for notes) */}
                                    <div className={isPresent ? "lg:col-span-7 xl:col-span-7 flex flex-col gap-4" : "col-span-12 flex flex-col gap-4"}>
                                        <div className="flex-1">
                                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                                                <AlertCircle className="w-3.5 h-3.5" /> Observações Individuais
                                            </label>
                                            <textarea
                                                className="w-full h-full min-h-[140px] bg-white border border-gray-200 rounded-xl p-4 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none shadow-sm placeholder-gray-300"
                                                placeholder={isPresent ? "Escreva aqui detalhes importantes sobre o dia do aluno para os pais..." : "Motivo da falta ou observação para os pais..."}
                                                value={r.observations || ''}
                                                onChange={(e) => updateReport(item.student_id, 'observations', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {students.length === 0 && (
                    <div className="p-10 text-center text-gray-400">
                        Nenhum aluno nesta turma.
                    </div>
                )}
            </div>
        </div >
    );
};
