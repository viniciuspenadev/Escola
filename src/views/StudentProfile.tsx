import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button, Card } from '../components/ui';
import {
    User, MapPin, Phone, FileText, Heart, Shield,
    ArrowLeft, Mail, GraduationCap, RefreshCw, CheckCircle
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { AttendanceDetailTable } from '../components/AttendanceDetailTable';
import { JustificationModal } from '../components/JustificationModal';

export const StudentProfileView: FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { addToast } = useToast();

    // Get Year Context from URL or Default
    const contextYear = Number(searchParams.get('year')) || new Date().getFullYear();
    const NEXT_YEAR = contextYear + 1;

    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'personal');
    const [renewalEnrollmentId, setRenewalEnrollmentId] = useState<string | null>(null);

    // State for Academic Data
    const [academicData, setAcademicData] = useState<{
        currentClass: any | null;
        attendance: { total: number; present: number; absent: number; justified: number } | null;
        reports: any[];
        grades: any[];
        loading: boolean;
    }>({
        currentClass: null,
        attendance: null,
        reports: [],
        grades: [],
        loading: true // Start loading when mounting or when tab switches to academic
    });

    // State for Detailed Attendance Management
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [justificationModal, setJustificationModal] = useState<{
        isOpen: boolean;
        recordId: string | null;
        date: string | null;
    }>({ isOpen: false, recordId: null, date: null });

    // ... (rest of imports/setup)

    useEffect(() => {
        const fetchStudentAndRenewal = async () => {
            if (!id) return;

            // 1. Fetch Student
            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('id', id)
                .single();

            if (studentError) {
                console.error('Error fetching student:', studentError);
                addToast('error', 'Erro ao carregar aluno');
                navigate('/alunos');
                return;
            }
            setStudent(studentData);

            // 2. Check for Renewal Enrollment (Next Year)
            const { data: renewalData } = await supabase
                .from('enrollments')
                .select('id')
                .eq('student_id', id)
                .eq('academic_year', NEXT_YEAR)
                .neq('status', 'cancelled') // Ignore cancelled
                .maybeSingle();

            if (renewalData) {
                setRenewalEnrollmentId(renewalData.id);
            }

            setLoading(false);
        };
        fetchStudentAndRenewal();
    }, [id, navigate, addToast, NEXT_YEAR]);

    // Fetch Academic Data when tab is active
    useEffect(() => {
        if (activeTab === 'academic' && id) {
            const fetchAcademic = async () => {
                try {
                    // A. Fetch Current Class (Filtered by Context Year)
                    const { data: classData } = await supabase
                        .from('class_enrollments')
                        .select('*, classes!inner(*)') // Inner join to filter by class year
                        .eq('student_id', id)
                        .eq('classes.school_year', contextYear) // Apply year filter
                        .maybeSingle();

                    const startDate = `${contextYear}-01-01`;
                    const endDate = `${contextYear}-12-31`;

                    // B. Fetch Attendance Stats
                    const { data: attendanceData } = await supabase
                        .from('student_attendance')
                        .select('status, class_attendance_sheets!inner(date)')
                        .eq('student_id', id)
                        .gte('class_attendance_sheets.date', startDate)
                        .lte('class_attendance_sheets.date', endDate);

                    const stats = attendanceData?.reduce((acc: any, curr: any) => {
                        acc.total++;
                        if (curr.status === 'present') acc.present++;
                        if (curr.status === 'absent') acc.absent++;
                        if (curr.status === 'justified') acc.justified++;
                        return acc;
                    }, { total: 0, present: 0, absent: 0, justified: 0 }) || { total: 0, present: 0, absent: 0, justified: 0 };

                    // B2. Fetch Detailed Attendance Records (for management table)
                    const { data: detailedAttendance } = await supabase
                        .from('student_attendance')
                        .select('id, status, justification, justification_document_url, justified_at, class_attendance_sheets!inner(date)')
                        .eq('student_id', id)
                        .gte('class_attendance_sheets.date', startDate)
                        .lte('class_attendance_sheets.date', endDate)
                        .order('date', { foreignTable: 'class_attendance_sheets', ascending: false });

                    // Map to component format
                    const mappedRecords = detailedAttendance?.map((record: any) => ({
                        id: record.id,
                        date: record.class_attendance_sheets.date,
                        status: record.status,
                        justification: record.justification,
                        justification_document_url: record.justification_document_url,
                        justified_at: record.justified_at
                    })) || [];

                    setAttendanceRecords(mappedRecords);

                    // C. Fetch Daily Reports
                    const { data: reportsData } = await supabase
                        .from('daily_reports')
                        .select('*')
                        .eq('student_id', id)
                        .gte('date', startDate)
                        .lte('date', endDate)
                        .order('date', { ascending: false })
                        .limit(5);

                    // D. Fetch Grades
                    const { data: gradesData } = await supabase
                        .from('student_grades')
                        .select('*, grade_books!inner(date, title, subject, max_score)')
                        .eq('student_id', id)
                        .gte('grade_books.date', startDate)
                        .lte('grade_books.date', endDate);

                    setAcademicData({
                        currentClass: classData?.classes || null,
                        attendance: stats,
                        reports: reportsData || [],
                        grades: gradesData || [],
                        loading: false
                    });

                } catch (error) {
                    console.error("Error fetching academic data:", error);
                }
            };
            fetchAcademic();
        }
    }, [activeTab, id, contextYear]);
    // ...
    // ... in return JSX ...
    <div className="mb-4">
        <p className="text-brand-200 text-xs uppercase tracking-wider font-bold">Status Atual</p>
        <p className="text-2xl font-bold">Matriculado</p>
        <p className="text-brand-300 text-sm">Ano Letivo {contextYear}</p>
    </div>

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    if (!student) return null;

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === id
                ? 'border-brand-600 text-brand-600 font-medium bg-brand-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/alunos')}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-2xl">
                            {student.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{student.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium uppercase">
                                    {student.status}
                                </span>
                                <span>• ID: {student.id.split('-')[0]}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => addToast('info', 'Em breve: Histórico')}>
                        <FileText className="w-4 h-4 mr-2" /> Histórico
                    </Button>

                    {renewalEnrollmentId ? (
                        <Button
                            className="bg-green-600 hover:bg-green-700 shadow-lg"
                            onClick={() => navigate(`/matriculas/${renewalEnrollmentId}`)}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Ver Matrícula {NEXT_YEAR}
                        </Button>
                    ) : (
                        <Button
                            disabled={loading}
                            onClick={async () => {
                                if (!confirm(`Deseja iniciar a renovação de matrícula para ${NEXT_YEAR}?`)) return;

                                setLoading(true);
                                try {
                                    // Map Student Data to Enrollment Details format
                                    const renewalDetails = {
                                        enrollment_type: 'renewal',
                                        student_cpf: student.cpf,
                                        rg: student.rg,
                                        birth_date: student.birth_date,
                                        // Address
                                        zip_code: student.address?.zip_code,
                                        address: student.address?.street,
                                        address_number: student.address?.number,
                                        neighbor: student.address?.neighbor,
                                        city: student.address?.city,
                                        state: student.address?.state,
                                        complement: student.address?.complement,
                                        // Health
                                        blood_type: student.health_info?.blood_type,
                                        allergies: student.health_info?.allergies,
                                        health_insurance: student.health_info?.health_insurance,
                                        health_insurance_number: student.health_info?.health_insurance_number,
                                        // Responsible
                                        parent_name: student.financial_responsible?.name,
                                        parent_cpf: student.financial_responsible?.cpf,
                                        parent_phone: student.financial_responsible?.phone,
                                    };

                                    const { data, error } = await supabase
                                        .from('enrollments')
                                        .insert({
                                            student_id: student.id,
                                            academic_year: NEXT_YEAR, // Explicitly set next year
                                            candidate_name: student.name,
                                            parent_email: student.financial_responsible?.email || 'pendente@email.com',
                                            status: 'draft',
                                            details: renewalDetails
                                        })
                                        .select()
                                        .single();

                                    if (error) throw error;

                                    addToast('success', `Renovação para ${NEXT_YEAR} iniciada!`);
                                    navigate(`/matriculas/${data.id}`);

                                } catch (err: any) {
                                    console.error(err);
                                    addToast('error', 'Erro ao iniciar renovação: ' + err.message);
                                    setLoading(false);
                                }
                            }}
                            className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/20"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Renovar para {NEXT_YEAR}
                        </Button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-gray-200 flex overflow-x-auto">
                <TabButton id="personal" label="Dados Pessoais" icon={User} />
                <TabButton id="academic" label="Acadêmico" icon={GraduationCap} />
                <TabButton id="health" label="Saúde" icon={Heart} />
                <TabButton id="documents" label="Documentos" icon={FileText} />
                <TabButton id="financial" label="Financeiro" icon={Shield} />
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column (Main Info) */}
                <div className="lg:col-span-2 space-y-6">

                    {activeTab === 'personal' && (
                        <div className="space-y-6 animate-fade-in">
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <User className="w-5 h-5 mr-2 text-brand-600" /> Identificação
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Nome Completo</label>
                                        <p className="text-gray-900 font-medium">{student.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Data de Nascimento</label>
                                        <p className="text-gray-900">{new Date(student.birth_date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">CPF</label>
                                        <p className="text-gray-900 font-mono">{student.cpf || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">RG</label>
                                        <p className="text-gray-900 font-mono">{student.rg || '-'}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <MapPin className="w-5 h-5 mr-2 text-brand-600" /> Endereço
                                </h3>
                                {/* Address Parsing */}
                                {student.address ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-gray-500 uppercase">Logradouro</label>
                                            <p className="text-gray-900">{student.address.street}, {student.address.number}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Bairro</label>
                                            <p className="text-gray-900">{student.address.neighbor}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Cidade/UF</label>
                                            <p className="text-gray-900">{student.address.city} - {student.address.state}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">CEP</label>
                                            <p className="text-gray-900 font-mono">{student.address.zip_code}</p>
                                        </div>
                                    </div>
                                ) : <p className="text-gray-400 italic">Endereço não cadastrado.</p>}
                            </Card>
                        </div>
                    )}

                    {activeTab === 'health' && (
                        <Card className="p-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <Heart className="w-5 h-5 mr-2 text-red-500" /> Saúde e Cuidados
                            </h3>
                            {student.health_info ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                            <label className="text-xs font-bold text-red-800 uppercase block mb-1">Tipo Sanguíneo</label>
                                            <p className="text-xl font-bold text-red-900">{student.health_info.blood_type || '?'}</p>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            <label className="text-xs font-bold text-blue-800 uppercase block mb-1">Plano de Saúde</label>
                                            <p className="text-blue-900 font-medium">{student.health_info.health_insurance || 'Não possui'}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Alergias</label>
                                        {student.health_info.allergies ? (
                                            <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md border border-yellow-200">
                                                ⚠️ {student.health_info.allergies}
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic">Nenhuma alergia relatada.</div>
                                        )}
                                    </div>
                                </div>
                            ) : <p className="text-gray-400">Sem dados de saúde.</p>}
                        </Card>
                    )}

                    {activeTab === 'documents' && (
                        <Card className="p-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-brand-600" /> Documentos Armazenados
                            </h3>
                            {student.documents && Object.keys(student.documents).length > 0 ? (
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.entries(student.documents).map(([key, url]: any) => (
                                        <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-brand-200 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-white p-2 rounded shadow-sm">
                                                    <FileText className="w-5 h-5 text-gray-400" />
                                                </div>
                                                <span className="font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                                            </div>
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">
                                                Visualizar
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    Nenhum documento digitalizado.
                                </div>
                            )}
                        </Card>
                    )}

                    {activeTab === 'financial' && (
                        <Card className="p-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <Shield className="w-5 h-5 mr-2 text-green-600" /> Responsável Financeiro
                            </h3>
                            {student.financial_responsible ? (
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5 text-green-700" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{student.financial_responsible.name}</p>
                                            <p className="text-xs text-gray-500">Principal Pagador</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500">CPF</p>
                                            <p className="font-mono text-gray-700">{student.financial_responsible.cpf}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Email</p>
                                            <p className="text-gray-700">{student.financial_responsible.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Telefone</p>
                                            <p className="text-gray-700">{student.financial_responsible.phone}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : <p className="text-gray-400">Responsável financeiro não definido.</p>}
                        </Card>
                    )}

                    {activeTab === 'academic' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Enrollment & Class Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="p-4 border-l-4 border-l-brand-500">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Turma Atual</h4>
                                    <div className="flex items-center gap-3">
                                        <div className="bg-brand-100 p-2 rounded-lg">
                                            <GraduationCap className="w-5 h-5 text-brand-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-lg">
                                                {academicData.currentClass ? academicData.currentClass.name : 'Sem Turma'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {academicData.currentClass ? `Sala ${academicData.currentClass.room || 'Principal'}` : 'Não enturmado'}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                                <Card className="p-4 border-l-4 border-l-green-500">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Frequência Global</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-green-600">
                                                {academicData.attendance?.total ? Math.round(((academicData.attendance.present + academicData.attendance.justified) / academicData.attendance.total) * 100) : 0}%
                                            </p>
                                            <p className="text-[10px] text-gray-400 uppercase">Presença</p>
                                        </div>
                                        <div className="h-8 w-px bg-gray-200"></div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">{academicData.attendance?.absent || 0} Faltas</p>
                                            <p className="text-xs text-gray-500">Justificadas: {academicData.attendance?.justified || 0}</p>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Recent Daily Reports */}
                            <Card className="p-0 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-brand-600" />
                                        Últimos Diários
                                    </h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {academicData.reports.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 text-sm">
                                            Nenhum diário registrado recentemente.
                                        </div>
                                    ) : (
                                        academicData.reports.map((report: any, i: number) => {
                                            // Fix Date Timezone: Treat YYYY-MM-DD as simple string or UTC
                                            // Splitting "2023-12-29" -> [2023, 11, 29]
                                            const [y, m, d] = report.date.split('-').map(Number);
                                            const date = new Date(y, m - 1, d); // Local time construction from parts

                                            const data = report.routine_data || {};
                                            return (
                                                <div key={i} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                                                    <div className="flex-col items-center text-center min-w-[3rem]">
                                                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                                                            {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                                        </span>
                                                        <span className="text-xl font-bold text-brand-700 block leading-none">
                                                            {date.getDate()}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex gap-2 flex-wrap">
                                                            {data.mood && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                                                    {data.mood}
                                                                </span>
                                                            )}
                                                            {data.meals?.lunch && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                                                    Almoço: {data.meals.lunch}
                                                                </span>
                                                            )}
                                                            {data.meals?.snack && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                                                    Lanche: {data.meals.snack}
                                                                </span>
                                                            )}
                                                            {data.sleep?.nap && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                                                    Sono: {data.sleep.nap}
                                                                </span>
                                                            )}
                                                            {data.hygiene && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700 border border-cyan-200">
                                                                    Higiene: {data.hygiene}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600 line-clamp-2">
                                                            {report.observations || report.activities || "Sem observações."}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>

                            {/* Grades Summary */}
                            {academicData.grades.length > 0 && (
                                <Card className="p-6">
                                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-brand-600" />
                                        Desempenho
                                    </h3>
                                    <div className="space-y-4">
                                        {academicData.grades.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-4">
                                                <div className="w-1/3">
                                                    <p className="text-sm font-medium text-gray-700 truncate">
                                                        {item.grade_books?.title || item.grade_books?.subject || 'Atividade'}
                                                    </p>
                                                </div>
                                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${Number(item.score) >= 7 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${(Number(item.score) / (item.grade_books?.max_score || 10)) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <div className="w-12 text-right font-bold text-gray-900">{item.score}</div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {/* Detailed Attendance Management */}
                            <AttendanceDetailTable
                                records={attendanceRecords}
                                onJustify={(recordId) => {
                                    const record = attendanceRecords.find(r => r.id === recordId);
                                    if (record) {
                                        setJustificationModal({
                                            isOpen: true,
                                            recordId: recordId,
                                            date: record.date
                                        });
                                    }
                                }}
                                loading={academicData.loading}
                            />
                        </div>
                    )}

                </div>

                {/* Right Column (Sidebar Actions) */}
                <div className="space-y-6">
                    <Card className="p-4 bg-brand-900 text-white border-none">
                        <div className="mb-4">
                            <p className="text-brand-200 text-xs uppercase tracking-wider font-bold">Status Atual</p>
                            <p className="text-2xl font-bold">Matriculado</p>
                            <p className="text-brand-300 text-sm">Ano Letivo {contextYear}</p>
                        </div>
                        <div className="h-1 bg-brand-800 rounded-full mb-4">
                            <div className="h-1 bg-green-400 rounded-full w-full"></div>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 bg-brand-800 rounded text-xs">Regular</span>
                            <span className="px-2 py-1 bg-brand-800 rounded text-xs">Em dia</span>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Ações Rápidas</h4>
                        <div className="space-y-2">
                            <Button variant="outline" className="w-full justify-start text-xs h-9">
                                <Mail className="w-3.5 h-3.5 mr-2" /> Enviar Email
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-xs h-9">
                                <Phone className="w-3.5 h-3.5 mr-2" /> Contatar Responsável
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Justification Modal */}
            {justificationModal.isOpen && justificationModal.recordId && justificationModal.date && (
                <JustificationModal
                    isOpen={justificationModal.isOpen}
                    onClose={() => setJustificationModal({ isOpen: false, recordId: null, date: null })}
                    attendanceRecordId={justificationModal.recordId}
                    studentId={id!}
                    date={justificationModal.date}
                    onSuccess={async () => {
                        // Refetch academic data to update stats and records
                        if (activeTab === 'academic' && id) {
                            const startDate = `${contextYear}-01-01`;
                            const endDate = `${contextYear}-12-31`;

                            // Refetch attendance stats
                            const { data: attendanceData } = await supabase
                                .from('student_attendance')
                                .select('status, class_attendance_sheets!inner(date)')
                                .eq('student_id', id)
                                .gte('class_attendance_sheets.date', startDate)
                                .lte('class_attendance_sheets.date', endDate);

                            const stats = attendanceData?.reduce((acc: any, curr: any) => {
                                acc.total++;
                                if (curr.status === 'present') acc.present++;
                                if (curr.status === 'absent') acc.absent++;
                                if (curr.status === 'justified') acc.justified++;
                                return acc;
                            }, { total: 0, present: 0, absent: 0, justified: 0 }) || { total: 0, present: 0, absent: 0, justified: 0 };

                            // Refetch detailed records
                            const { data: detailedAttendance } = await supabase
                                .from('student_attendance')
                                .select('id, status, justification, justification_document_url, justified_at, class_attendance_sheets!inner(date)')
                                .eq('student_id', id)
                                .gte('class_attendance_sheets.date', startDate)
                                .lte('class_attendance_sheets.date', endDate)
                                .order('date', { foreignTable: 'class_attendance_sheets', ascending: false });

                            const mappedRecords = detailedAttendance?.map((record: any) => ({
                                id: record.id,
                                date: record.class_attendance_sheets.date,
                                status: record.status,
                                justification: record.justification,
                                justification_document_url: record.justification_document_url,
                                justified_at: record.justified_at
                            })) || [];

                            setAttendanceRecords(mappedRecords);
                            setAcademicData(prev => ({ ...prev, attendance: stats }));
                        }
                    }}
                />
            )}
        </div>
    );
};
