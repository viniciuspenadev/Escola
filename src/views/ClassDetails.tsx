import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button, Card, Input } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { ClassAttendance } from '../components/ClassAttendance';
import { ClassDailyAgenda } from '../components/ClassDailyAgenda';
import { ClassGrades } from '../components/ClassGrades';
import { PlanningKanban } from './planning/components/PlanningKanban';
import { PlanningCalendar } from './planning/components/PlanningCalendar';
import { CustomDatePicker } from '../components/ui/CustomDatePicker';
import { planningService } from '../services/planningService';

import {
    ArrowLeft,
    Users,
    GraduationCap,
    Trash2,
    UserPlus,
    Search,
    School,
    BookOpen,
    Sun,
    Moon,
    Clock,
    Calendar,
    FileText,
    Layout,
    X,
    Check,
    Plus
} from 'lucide-react';
import type { Class, ClassEnrollment } from '../types';

export const ClassDetailsView: FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [classData, setClassData] = useState<Class | null>(null);
    const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'attendance' | 'diary' | 'grades' | 'planning'>('students');
    const [planningViewMode, setPlanningViewMode] = useState<'week' | 'month'>('week');
    const [events, setEvents] = useState<any[]>([]); // Store School Events

    // Shared Date State
    const [selectedDate, setSelectedDate] = useState(() => {
        // Feature: Default date based on Class School Year
        // If class year is NOT current year, default to end of that year? Or start? start is safer.
        // But we don't have classData here yet... so wait for effect or use a smart default if we knew the year from context?
        // Actually, we can just default to today, and then EFFECT will correct it if out of bounds.
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    // Add Student Modal State
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    const [availableStudents, setAvailableStudents] = useState<any[]>([]);

    // Add Teacher Modal State
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [teacherSearch, setTeacherSearch] = useState('');
    const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);

    // Date Picker Highlights
    const [lessonDates, setLessonDates] = useState<string[]>([]);

    // Feature: Fetch lesson dates for calendar highlights
    const fetchLessonDates = async () => {
        if (!classData) return;
        try {
            const dates = await planningService.getLessonDates(
                id!,
                `${classData.school_year}-01-01`,
                `${classData.school_year}-12-31`
            );
            setLessonDates(dates);
        } catch (error) {
            console.error('Error fetching lesson dates:', error);
        }
    };

    useEffect(() => {
        if (classData) {
            fetchLessonDates();
            fetchEvents();
        }
    }, [classData, planningViewMode, selectedDate]); // Refetch when view/date changes

    const fetchEvents = async () => {
        if (!id) return;

        let startStr, endStr;
        const d = new Date(selectedDate + 'T12:00:00'); // Use same date logic as components
        const year = d.getFullYear();

        if (planningViewMode === 'month') {
            const month = d.getMonth();
            startStr = new Date(year, month, 1).toISOString().split('T')[0];
            endStr = new Date(year, month + 1, 0).toISOString().split('T')[0];
        } else {
            // Week logic
            const start = new Date(d);
            const day = start.getDay() || 7;
            if (day !== 1) start.setHours(-24 * (day - 1));

            const end = new Date(start);
            end.setDate(end.getDate() + 4); // Friday

            startStr = start.toISOString().split('T')[0];
            endStr = end.toISOString().split('T')[0];
        }

        const { data } = await supabase
            .from('events')
            .select('*')
            .or(`class_id.is.null,class_id.eq.${id}`)
            .gte('start_time', `${startStr}T00:00:00`)
            .lte('start_time', `${endStr}T23:59:59`);

        if (data) setEvents(data);
    };

    // Feature: Auto-correct date when class loads
    useEffect(() => {
        if (classData?.school_year) {
            const year = parseInt(classData.school_year.toString());
            const currentYearStr = selectedDate.split('-')[0];
            const currentYearInt = parseInt(currentYearStr);

            if (year !== currentYearInt) {
                // If we are viewing a class from 2024, but date is 2026, snap to 2024-12-01 (or today if same year)
                // Let's just snap to the last valid school day of that year allowed? Or the first?
                // Let's safe bet: YYYY-MM-DD -> keep MM-DD if valid, else 01-01
                // Actually user asked to "travas" (lock).

                // If today is NOT in the target year, move to target year.
                // Auto-correct to start of school year
                setSelectedDate(`${year}-02-01`);
            }
        }
    }, [classData?.school_year]);


    // Validation Logic
    const minDate = classData ? `${classData.school_year}-01-01` : undefined;
    const maxDate = classData ? `${classData.school_year}-12-31` : undefined;

    const fetchClassDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('classes')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setClassData(data);
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar turma');
            navigate('/turmas');
        }
    };

    const fetchEnrollments = async () => {
        try {
            const { data, error } = await supabase
                .from('class_enrollments')
                .select(`
                    *,
                    student:students(id, name, photo_url),
                    enrollment:enrollments(id, status)
                `)
                .eq('class_id', id);

            if (error) throw error;
            setEnrollments(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchTeachers = async () => {
        try {
            const { data, error } = await supabase
                .from('class_teachers')
                .select(`
                    *,
                    teacher:profiles(id, name, email)
                `)
                .eq('class_id', id);

            if (error) throw error;
            setTeachers(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchAvailableStudents = async () => {
        if (!classData) return;

        try {
            // REGRA: Só mostrar alunos com Matrícula APROVADA para o ANO LETIVO da turma.
            const { data, error } = await supabase
                .from('enrollments')
                .select('id, student_id, candidate_name, student:students(name)')
                .eq('status', 'approved')
                .eq('academic_year', classData.school_year)
                .not('student_id', 'is', null)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter out those already in THIS class
            const currentStudentIds = enrollments.map(e => e.student_id);
            const available = data ? data.filter(e => !currentStudentIds.includes(e.student_id)) : [];

            setAvailableStudents(available);
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao buscar alunos disponíveis');
        }
    };

    const fetchAvailableTeachers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'TEACHER');

            if (error) throw error;

            const existingIds = teachers.map(t => t.teacher_id);
            setAvailableTeachers(data.filter(t => !existingIds.includes(t.id)));
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddStudent = async (enrollmentId: string, studentId: string) => {
        try {
            const { error } = await supabase
                .from('class_enrollments')
                .insert({
                    class_id: id,
                    enrollment_id: enrollmentId,
                    student_id: studentId
                });

            if (error) throw error;

            addToast('success', 'Aluno adicionado!');
            setIsAddStudentOpen(false);
            fetchEnrollments();
            fetchClassDetails(); // Update counts if any
        } catch (error: any) {
            addToast('error', error.message);
        }
    };

    const handleAddTeacher = async (teacherId: string) => {
        try {
            const { error } = await supabase
                .from('class_teachers')
                .insert({
                    class_id: id,
                    teacher_id: teacherId,
                    is_primary: teachers.length === 0 // First one is primary by default
                });

            if (error) throw error;

            addToast('success', 'Professor adicionado!');
            setIsAddTeacherOpen(false);
            fetchTeachers();
        } catch (error: any) {
            addToast('error', error.message);
        }
    };

    useEffect(() => {
        if (id) {
            Promise.all([fetchClassDetails(), fetchEnrollments(), fetchTeachers()])
                .finally(() => setLoading(false));
        }
    }, [id]);

    useEffect(() => {
        if (isAddStudentOpen) fetchAvailableStudents();
    }, [isAddStudentOpen]);

    useEffect(() => {
        if (isAddTeacherOpen) fetchAvailableTeachers();
    }, [isAddTeacherOpen]);

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;
    if (!classData) return null;

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header / Hero */}
            <div className="relative bg-white rounded-3xl border border-gray-200 shadow-sm">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-brand-600 to-indigo-700 opacity-90 rounded-3xl" />
                <div className="absolute top-0 left-0 w-full h-32 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 rounded-t-3xl" />

                <div className="relative pt-6 px-8 pb-8">
                    <div className="flex justify-between items-start mb-6">
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-white/20 hover:text-white"
                            onClick={() => navigate('/turmas')}
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Voltar
                        </Button>

                        <div className="flex items-center gap-3">
                            {/* Date Picker Wrapper */}
                            <div className="relative group">
                                <CustomDatePicker
                                    value={selectedDate}
                                    onChange={setSelectedDate}
                                    minDate={minDate}
                                    maxDate={maxDate}
                                    highlightedDates={lessonDates}
                                />
                                {/* Label helper on hover */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    Filtrar Data ({classData?.school_year})
                                </div>
                            </div>

                            <Button
                                variant="ghost"
                                className="bg-white/10 text-white hover:bg-red-500 hover:text-white border border-white/20"
                                onClick={async () => {
                                    if (confirm('Tem certeza que deseja excluir esta turma? Esta ação não pode ser desfeita.')) {
                                        setLoading(true);
                                        try {
                                            const { error } = await supabase.from('classes').delete().eq('id', id);
                                            if (error) throw error;
                                            addToast('success', 'Turma excluída com sucesso');
                                            navigate('/turmas');
                                        } catch (err: any) {
                                            addToast('error', 'Erro ao excluir: ' + err.message);
                                            setLoading(false);
                                        }
                                    }
                                }}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir Turma
                            </Button>
                        </div>
                    </div >

                    <div className="flex flex-col md:flex-row gap-8 items-end">
                        <div className="w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center text-4xl font-bold text-brand-600 border-4 border-white/50 z-10">
                            {classData.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 mb-2 text-white z-10">
                            <h1 className="text-4xl font-bold tracking-tight mb-2 text-shadow-sm">{classData.name}</h1>
                            <div className="flex items-center gap-4 text-brand-50 font-medium text-sm">
                                <span className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                                    <School className="w-4 h-4" /> {classData.school_year}
                                </span>
                                <span className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md capitalize">
                                    {classData.shift === 'morning' ? <Sun className="w-4 h-4" /> : classData.shift === 'night' ? <Moon className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                    {classData.shift === 'morning' ? 'Manhã' : classData.shift === 'afternoon' ? 'Tarde' : classData.shift === 'night' ? 'Noite' : 'Integral'}
                                </span>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="flex gap-4 z-10 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 min-w-[140px]">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Alunos</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-gray-900">{enrollments.length}</span>
                                    <span className="text-xs text-gray-400">/ {classData.capacity}</span>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 min-w-[140px]">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Professores</p>
                                <span className="text-2xl font-bold text-gray-900">{teachers.length}</span>
                            </div>
                        </div>
                    </div>
                </div >
            </div >

            {/* Navigation Tabs */}
            < div className="flex justify-center" >
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex gap-1 overflow-x-auto max-w-full">
                    {[
                        { id: 'students', label: 'Alunos', icon: Users },
                        { id: 'teachers', label: 'Professores', icon: GraduationCap },
                        { id: 'attendance', label: 'Chamada', icon: BookOpen },
                        { id: 'diary', label: 'Diário', icon: BookOpen },
                        { id: 'grades', label: 'Notas', icon: FileText },
                        { id: 'planning', label: 'Atividades', icon: Layout }


                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`
                                    flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                                    ${isActive
                                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }
                                `}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div >

            {/* Content Area */}
            < div className="min-h-[400px] animate-fade-in-up" >
                {activeTab === 'students' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Lista de Alunos</h3>
                            <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={() => setIsAddStudentOpen(true)}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Adicionar Aluno
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {enrollments.length === 0 ? (
                                <div className="col-span-full bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <Users className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-gray-900 font-medium mb-1">Nenhum aluno enturmado</h3>
                                    <p className="text-gray-500 text-sm">Adicione alunos para começar a gerenciar.</p>
                                </div>
                            ) : (
                                enrollments.map((item) => (
                                    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-brand-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm uppercase ring-2 ring-white shadow-sm">
                                                {item.student?.name?.substring(0, 2) || 'AL'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors">{item.student?.name}</p>
                                                <p className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full inline-block mt-1">Mat: {item.enrollment_id.substring(0, 8)}</p>
                                            </div>
                                        </div>
                                        <button className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100" title="Remover aluno">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {
                    activeTab === 'teachers' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">Corpo Docente</h3>
                                <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={() => setIsAddTeacherOpen(true)}>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Adicionar Professor
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {teachers.map((t) => (
                                    <Card key={t.id} className="p-5 flex items-center gap-4 hover:shadow-md transition-shadow border-gray-200">
                                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-brand-50 rounded-2xl flex items-center justify-center text-brand-600 shadow-inner">
                                            <GraduationCap className="w-7 h-7" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 truncate">{t.teacher?.name}</h4>
                                            <p className="text-xs text-gray-500 truncate">{t.teacher?.email}</p>
                                            {t.is_primary && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 mt-1">
                                                    Professor(a) Regente
                                                </span>
                                            )}
                                        </div>
                                        <button className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </Card>
                                ))}
                                {teachers.length === 0 && (
                                    <div className="col-span-full p-10 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>Nenhum professor atribuído.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'attendance' && id && (
                        <ClassAttendance classId={id} date={selectedDate} />
                    )
                }

                {
                    activeTab === 'diary' && id && (
                        <ClassDailyAgenda classId={id} date={selectedDate} />
                    )
                }

                {
                    activeTab === 'grades' && id && (
                        <ClassGrades classId={id} />
                    )
                }

                {
                    activeTab === 'planning' && id && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-brand-600" />
                                    Plano de Atividades
                                </h3>
                                {/* View Toggles */}
                                <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                                    <button
                                        onClick={() => setPlanningViewMode('week')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${planningViewMode === 'week' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <Layout className="w-4 h-4" /> Semana
                                    </button>
                                    <button
                                        onClick={() => setPlanningViewMode('month')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${planningViewMode === 'month' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <Calendar className="w-4 h-4" /> Mês
                                    </button>
                                </div>
                            </div>

                            {/* Note: We pass selectedDate (from global filter) to the components */}
                            {planningViewMode === 'week' ? (
                                <PlanningKanban classId={id} date={new Date(selectedDate + 'T12:00:00')} events={events} />
                            ) : (
                                <PlanningCalendar classId={id} date={new Date(selectedDate + 'T12:00:00')} events={events} />
                            )}
                        </div>
                    )
                }

            </div >

            {/* Modal Add Student */}
            {
                isAddStudentOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in max-h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Adicionar Aluno</h2>
                                <button onClick={() => setIsAddStudentOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <Input
                                placeholder="Buscar aluno por nome..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                icon={<Search className="w-4 h-4 text-gray-400" />}
                                className="bg-gray-50 border-gray-200"
                            />
                            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {availableStudents
                                    .filter(s => (s.candidate_name || '').toLowerCase().includes(studentSearch.toLowerCase()) || (s.student?.name || '').toLowerCase().includes(studentSearch.toLowerCase()))
                                    .map(s => (
                                        <div key={s.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all">
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">{s.student?.name || s.candidate_name}</p>
                                                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Matrícula Aprovada
                                                </p>
                                            </div>
                                            <Button size="sm" className="bg-gray-900 text-white hover:bg-brand-600" onClick={() => handleAddStudent(s.id, s.student_id)}>
                                                <Plus className="w-3 h-3 mr-1" /> Adicionar
                                            </Button>
                                        </div>
                                    ))
                                }
                                {availableStudents.length === 0 && <p className="text-center text-gray-500 py-8">Nenhum aluno disponível para enturmar.</p>}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Add Teacher */}
            {
                isAddTeacherOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in max-h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Adicionar Professor</h2>
                                <button onClick={() => setIsAddTeacherOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <Input
                                placeholder="Buscar professor por nome..."
                                value={teacherSearch}
                                onChange={(e) => setTeacherSearch(e.target.value)}
                                icon={<Search className="w-4 h-4 text-gray-400" />}
                                className="bg-gray-50 border-gray-200"
                            />
                            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {availableTeachers
                                    .filter(t => (t.name || '').toLowerCase().includes(teacherSearch.toLowerCase()))
                                    .map(t => (
                                        <div key={t.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all">
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">{t.name}</p>
                                                <p className="text-xs text-gray-500">{t.email}</p>
                                            </div>
                                            <Button size="sm" className="bg-gray-900 text-white hover:bg-brand-600" onClick={() => handleAddTeacher(t.id)}>
                                                <Plus className="w-3 h-3 mr-1" /> Adicionar
                                            </Button>
                                        </div>
                                    ))
                                }
                                {availableTeachers.length === 0 && <p className="text-center text-gray-500 py-8">Nenhum professor disponível.</p>}
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
};
