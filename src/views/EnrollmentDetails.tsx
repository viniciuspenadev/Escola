import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../services/supabase';
import { Button, Card, Input, Modal } from '../components/ui';
import {
    Loader2, ArrowLeft, User, FileText,
    Upload, Building, CheckCircle,
    ExternalLink, Trash2, Download, DollarSign, Calendar, Shield, RefreshCw, GraduationCap,
    UserPlus, X, Users
} from 'lucide-react';
import { ParentAccessGenerator } from '../components/ParentAccessGenerator';


// Sections map for Tabs
const SECTIONS = [
    { id: 'personal', label: 'Dados do Aluno', icon: User },
    { id: 'address', label: 'Endereço', icon: Building },
    { id: 'docs', label: 'Documentos', icon: FileText },
    { id: 'financial', label: 'Financeiro', icon: DollarSign },
    { id: 'contract', label: 'Contrato', icon: FileText },
    { id: 'academic', label: 'Boletim', icon: GraduationCap },
];

// Document Types Definitions
const REQUIRED_DOCS = [
    { id: 'student_id', label: 'Certidão de Nascimento / RG do Aluno' },
    { id: 'parent_id', label: 'RG / CPF do Responsável' },
    { id: 'residency', label: 'Comprovante de Residência' },
    { id: 'vaccination', label: 'Carteira de Vacinação' },
    { id: 'transfer', label: 'Declaração de Transferência / Histórico' },
    { id: 'photo', label: 'Foto 3x4 do Aluno' }
];

export const EnrollmentDetailsView: FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    // State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchingCep, setSearchingCep] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');
    const [enrollment, setEnrollment] = useState<any>(null);
    const [generatingRenewal, setGeneratingRenewal] = useState(false);

    // Form Data (Flat structure mapped to db)
    const [formData, setFormData] = useState<any>({});
    const [details, setDetails] = useState<any>({});
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showFinancialConfirmModal, setShowFinancialConfirmModal] = useState(false);
    const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
    const [showManualAccess, setShowManualAccess] = useState(false);
    const [guardians, setGuardians] = useState<any[]>([]);
    const [showGuardianModal, setShowGuardianModal] = useState(false);

    // Financial State
    const [financialPlans, setFinancialPlans] = useState<any[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [installments, setInstallments] = useState<any[]>([]);
    const [generating, setGenerating] = useState(false);

    // Academic State
    const [enrollmentGrades, setEnrollmentGrades] = useState<any[]>([]);

    // Fetch Data
    useEffect(() => {
        const fetchEnrollment = async () => {
            if (!id) return;
            // 1. Fetch Enrollment Data
            const { data, error } = await supabase
                .from('enrollments')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                addToast('error', 'Erro ao carregar');
                navigate('/matriculas');
                return;
            }

            setEnrollment(data);
            setFormData({
                candidate_name: data.candidate_name,
                parent_email: data.parent_email,
                invite_token: data.invite_token
            });
            setDetails(data.details || {});

            // 2. Fetch Financial Data (Plans & Installments)
            const { data: plans } = await supabase.from('financial_plans').select('*');
            if (plans) setFinancialPlans(plans);

            const { data: existingInstallments } = await supabase
                .from('installments')
                .select('*')
                .eq('enrollment_id', id)
                .order('installment_number', { ascending: true });

            if (existingInstallments) setInstallments(existingInstallments);

            // 3. Fetch Grades (if approved)
            if (data.status === 'approved' && data.student_id) {
                const { data: grades } = await supabase
                    .from('student_grades')
                    .select('*, grade_book:grade_books(title, term, subject, max_score, weight)')
                    .eq('enrollment_id', id);

                if (grades) setEnrollmentGrades(grades);
            }

            setLoading(false);

            // 4. Fetch Guardians if student exists
            if (data.student_id) {
                fetchGuardians(data.student_id);
            }
        };
        fetchEnrollment();
    }, [id]);

    // Fetch Guardians
    const fetchGuardians = async (studentId: string) => {
        try {
            const { data, error } = await supabase
                .from('student_guardians')
                .select('guardian_id, relationship, profiles!inner(name, email)')
                .eq('student_id', studentId);

            if (error) throw error;
            setGuardians(data || []);
        } catch (err) {
            console.error('Error fetching guardians:', err);
        }
    };

    // Sync changes to Student Record (if linked)
    const syncStudentData = async (studentId: string, currentForm: any, currentDetails: any) => {
        try {
            const studentUpdate = {
                name: currentForm.candidate_name,
                cpf: currentDetails.student_cpf,
                rg: currentDetails.rg,
                birth_date: currentDetails.birth_date,
                address: {
                    zip_code: currentDetails.zip_code,
                    street: currentDetails.address,
                    number: currentDetails.address_number,
                    neighbor: currentDetails.neighbor,
                    city: currentDetails.city,
                    state: currentDetails.state,
                    complement: currentDetails.complement
                },
                health_info: {
                    blood_type: currentDetails.blood_type,
                    allergies: currentDetails.allergies,
                    health_insurance: currentDetails.health_insurance,
                    health_insurance_number: currentDetails.health_insurance_number
                },
                financial_responsible: {
                    name: currentDetails.parent_name,
                    cpf: currentDetails.parent_cpf,
                    email: currentForm.parent_email,
                    phone: currentDetails.parent_phone
                }
            };

            const { error } = await supabase
                .from('students')
                .update(studentUpdate)
                .eq('id', studentId);

            if (error) console.error('Error syncing student data:', error);
        } catch (err) {
            console.error('Error in syncStudentData:', err);
        }
    };

    // Auto-Save Logic (Debounced)
    useEffect(() => {
        if (!enrollment || loading) return;

        const timer = setTimeout(async () => {
            setSaving(true);
            const { error } = await supabase
                .from('enrollments')
                .update({
                    candidate_name: formData.candidate_name,
                    parent_email: formData.parent_email,
                    details: details,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            // Sync to Student if linked
            if (!error && enrollment.student_id) {
                await syncStudentData(enrollment.student_id, formData, details);
            }

            setSaving(false);
            if (error) console.error('Auto-save failed', error);
        }, 1000); // 1s debounce

        return () => clearTimeout(timer);
    }, [formData, details]);

    // Document Logic
    const getDocStatus = (docId: string) => {
        const doc = details.documents?.[docId];
        if (!doc) return 'pending';
        return doc.status; // 'uploaded', 'approved', 'rejected'
    };

    // Authorized Pickups Logic
    const addPickupPerson = () => {
        const currentList = details.authorized_pickups || [];
        const newList = [...currentList, { name: '', relation: '', cpf: '' }];
        setDetails({ ...details, authorized_pickups: newList });
    };

    const removePickupPerson = (index: number) => {
        const currentList = details.authorized_pickups || [];
        const newList = currentList.filter((_: any, i: number) => i !== index);
        setDetails({ ...details, authorized_pickups: newList });
    };

    const updatePickupPerson = (index: number, field: string, value: string) => {
        const currentList = details.authorized_pickups || [];
        const newList = currentList.map((person: any, i: number) => {
            if (i === index) return { ...person, [field]: value };
            return person;
        });
        setDetails({ ...details, authorized_pickups: newList });
    };

    // Financial Logic
    const handleUpdateInstallment = (index: number, field: string, value: string) => {
        const list = [...installments];
        list[index] = { ...list[index], [field]: value };
        setInstallments(list);
    };

    const handleSaveInstallments = async () => {
        setSaving(true);
        try {
            // Upsert all modified installments
            const { error } = await supabase.from('installments').upsert(installments);
            if (error) throw error;
            addToast('success', 'Parcelas atualizadas com sucesso!');
        } catch (error: any) {
            addToast('error', 'Erro ao salvar parcelas: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateClick = () => {
        if (!selectedPlanId) return addToast('error', 'Selecione um plano!');
        setShowFinancialConfirmModal(true);
    };

    const handleGenerateInstallments = async () => {
        setGenerating(true);
        try {
            const plan = financialPlans.find(p => p.id === selectedPlanId);
            if (!plan) return;

            setShowFinancialConfirmModal(false);

            // Delete existing (if any - optional strategy)
            await supabase.from('installments').delete().eq('enrollment_id', id);

            const newInstallments = [];
            const baseDate = new Date();
            const monthlyValue = plan.total_value / plan.installments_count;

            for (let i = 1; i <= plan.installments_count; i++) {
                const dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 5); // 5th of next months
                newInstallments.push({
                    enrollment_id: id,
                    installment_number: i,
                    value: monthlyValue,
                    due_date: dueDate.toLocaleDateString('en-CA'), // YYYY-MM-DD local
                    status: 'pending'
                });
            }

            const { error } = await supabase.from('installments').insert(newInstallments);
            if (error) throw error;

            // Refresh
            const { data } = await supabase
                .from('installments')
                .select('*')
                .eq('enrollment_id', id)
                .order('installment_number');

            if (data) setInstallments(data);
            addToast('success', 'Parcelas geradas com sucesso!');

        } catch (error: any) {
            addToast('error', 'Erro ao gerar parcelas: ' + error.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleFileUploadRequest = async (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        const file = e.target.files[0];
        // Path: enrollments/ID/docID_filename
        const filePath = `enrollments/${id}/${docId}_${file.name}`;

        try {
            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Update Enrollment Details (Metadata)
            const newDocMetadata = {
                status: 'uploaded', // Pending approval
                file_path: filePath,
                file_name: file.name,
                uploaded_at: new Date().toISOString()
            };

            const newDetails = {
                ...details,
                documents: {
                    ...(details.documents || {}),
                    [docId]: newDocMetadata
                }
            };

            setDetails(newDetails); // Optimistic UI

            // Persist immediately
            await supabase.from('enrollments').update({ details: newDetails }).eq('id', id);

        } catch (error: any) {
            alert('Erro no upload: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDocAction = async (docId: string, action: 'approve' | 'reject' | 'delete') => {
        const currentDoc = details.documents?.[docId];
        if (!currentDoc) return;

        let newStatus = currentDoc.status;
        let shouldDelete = false;

        if (action === 'approve') newStatus = 'approved';
        if (action === 'reject') newStatus = 'rejected';
        if (action === 'delete') shouldDelete = true;

        if (shouldDelete) {
            if (!confirm('Excluir este documento e seus dados?')) return;
            // Remove from Storage
            await supabase.storage.from('documents').remove([currentDoc.file_path]);

            // Remove from Metadata
            const newDocs = { ...details.documents };
            delete newDocs[docId];

            const newDetails = { ...details, documents: newDocs };
            setDetails(newDetails);
            await supabase.from('enrollments').update({ details: newDetails }).eq('id', id);
        } else {
            // Update Status
            const newDetails = {
                ...details,
                documents: {
                    ...details.documents,
                    [docId]: { ...currentDoc, status: newStatus }
                }
            };
            setDetails(newDetails);
            await supabase.from('enrollments').update({ details: newDetails }).eq('id', id);
        }
    };

    const getDocUrl = (docId: string) => {
        const path = details.documents?.[docId]?.file_path;
        if (!path) return '#';
        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        return data.publicUrl;
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    // ViaCEP Integration

    const handleCepBlur = async () => {
        const cep = details.zip_code?.replace(/\D/g, '');
        if (!cep || cep.length !== 8) return;

        setSearchingCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                alert('CEP não encontrado!');
                return;
            }

            setDetails((prev: any) => ({
                ...prev,
                address: data.logradouro,
                neighbor: data.bairro,
                city: data.localidade,
                state: data.uf,
                complement: data.complemento // Optional, sometimes ViaCEP returns it
            }));
        } catch (error) {
            console.error('Error fetching CEP:', error);
            addToast('error', 'Erro ao buscar CEP.');
        } finally {
            setSearchingCep(false);
        }
    };

    const copyLink = async () => {
        const link = `${window.location.origin}/completar-matricula/${enrollment.invite_token}`;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link);
                addToast('success', 'Link copiado!');
            } else {
                // Fallback for non-secure contexts (HTTP)
                const textArea = document.createElement("textarea");
                textArea.value = link;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                try {
                    document.execCommand('copy');
                    addToast('success', 'Link copiado!');
                } catch (err) {
                    console.error('Fallback copy failed', err);
                    prompt('Copie o link manualmente:', link);
                }

                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('Copy failed', err);
            prompt('Copie o link manualmente:', link);
        }
    };

    const handleApproveClick = () => {
        setShowApproveModal(true);
    };

    const handleDeleteEnrollment = async () => {
        if (!confirm('Tem certeza que deseja EXCLUIR este rascunho de matrícula? Esta ação não pode ser desfeita.')) return;

        setSaving(true);
        try {
            const { error } = await supabase.from('enrollments').delete().eq('id', id);
            if (error) throw error;
            addToast('success', 'Rascunho excluído com sucesso!');
            navigate('/matriculas');
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao excluir: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSendForAnalysis = async () => {
        if (!confirm('Enviar matrícula para análise? O pai não poderá mais editar até que você aprove ou recuse.')) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('enrollments')
                .update({ status: 'sent' }) // DB Constraint uses 'sent'
                .eq('id', id);

            if (error) throw error;

            setEnrollment({ ...enrollment, status: 'sent' });
            addToast('success', 'Matrícula enviada para análise!');
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao enviar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const performApproval = async () => {

        setSaving(true); // Re-using saving state for loading indicator
        try {
            const { data, error } = await supabase.rpc('approve_enrollment', {
                enrollment_id: id
            });

            if (error) throw error;

            setShowApproveModal(false);

            // Show Success Modal instead of Alert
            if (data && data.student_id) {
                setCreatedStudentId(data.student_id);
                setShowSuccessModal(true);
            }

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao aprovar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Renewal Logic
    const handleRenewal = async () => {
        if (!enrollment) return;

        // Calculate Next Year
        const currentYear = enrollment.academic_year || new Date().getFullYear();
        const nextYear = currentYear + 1;

        if (!confirm(`Deseja iniciar a rematrícula de ${formData.candidate_name} para ${nextYear}?`)) return;

        setGeneratingRenewal(true);
        try {
            // 1. Check if already exists
            if (enrollment.student_id) {
                const { data: existing } = await supabase
                    .from('enrollments')
                    .select('id')
                    .eq('student_id', enrollment.student_id)
                    .eq('academic_year', nextYear)
                    .single();

                if (existing) {
                    addToast('info', `Já existe uma matrícula para ${nextYear}! Redirecionando...`);
                    navigate(`/matriculas/${existing.id}`);
                    return;
                }
            }

            // 2. Clone Data
            const { data, error } = await supabase
                .from('enrollments')
                .insert({
                    student_id: enrollment.student_id, // Link to same student
                    candidate_name: formData.candidate_name,
                    parent_email: formData.parent_email,
                    parent_name: details.parent_name,
                    status: 'draft',
                    academic_year: nextYear,
                    details: {
                        ...details,
                        enrollment_type: 'renewal',
                        documents: {} // Clear docs as they might need re-upload or validation
                    }
                })
                .select()
                .single();

            if (error) throw error;

            addToast('success', `Rematrícula para ${nextYear} iniciada!`);
            navigate(`/matriculas/${data.id}`);

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao renovar: ' + error.message);
        } finally {
            setGeneratingRenewal(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/matriculas')}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-900">{formData.candidate_name || 'Nova Matrícula'}</h1>

                            {(enrollment?.student_id || enrollment?.details?.enrollment_type === 'renewal') && (
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-blue-200">
                                    Renovação
                                </span>
                            )}
                            {enrollment?.academic_year && (
                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold border border-gray-200 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {enrollment.academic_year}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className={`w-2 h-2 rounded-full ${saving ? 'bg-yellow-400' : 'bg-green-400'}`} />
                            {saving ? 'Processando...' : 'Salvo'}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* Renewal Button */}
                    {enrollment?.status === 'approved' && (
                        <Button
                            variant="outline"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={handleRenewal}
                            disabled={generatingRenewal}
                        >
                            {generatingRenewal ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Renovar para {enrollment.academic_year ? enrollment.academic_year + 1 : 'Próximo Ano'}
                        </Button>
                    )}

                    {enrollment?.status === 'approved' ? (
                        <div className="flex gap-2">
                            {guardians.length > 0 ? (
                                <Button
                                    onClick={() => setShowGuardianModal(true)}
                                    className="bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
                                >
                                    <Users className="w-4 h-4 mr-2" />
                                    Gerenciar Acessos
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => setShowManualAccess(true)}
                                    className="bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
                                >
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Criar Acesso
                                </Button>
                            )}

                        </div>
                    ) : (
                        <div className="flex gap-2">
                            {/* DELETE BUTTON (Allowed for Draft/Completed/Sent/Rejected) */}
                            {enrollment?.status !== 'approved' && (
                                <Button
                                    variant="outline"
                                    className="text-red-500 border-red-200 hover:bg-red-50"
                                    onClick={handleDeleteEnrollment}
                                    disabled={saving}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir
                                </Button>
                            )}

                            {/* RETURN TO DRAFT (Reopen for Editing) */}
                            {enrollment?.status === 'sent' && (
                                <Button
                                    variant="outline"
                                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                    onClick={async () => {
                                        if (!confirm('Deseja reabrir esta matrícula para edição pelo responsável?')) return;
                                        setSaving(true);
                                        try {
                                            const { error } = await supabase
                                                .from('enrollments')
                                                .update({ status: 'draft' }) // Back to draft
                                                .eq('id', enrollment.id);
                                            if (error) throw error;

                                            // Update local state
                                            setEnrollment({ ...enrollment, status: 'draft' });
                                            alert('Matrícula reaberta para edição!');
                                        } catch (err) {
                                            alert('Erro ao reabrir');
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                    disabled={saving}
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Reabrir Edição
                                </Button>
                            )}

                            {/* SEND FOR ANALYSIS BUTTON (Draft or Completed -> Sent) */}
                            {['draft', 'completed'].includes(enrollment?.status) && (
                                <Button
                                    className="bg-amber-500 text-white hover:bg-amber-600 border-transparent"
                                    onClick={handleSendForAnalysis}
                                    disabled={saving}
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Enviar p/ Análise
                                </Button>
                            )}

                            <Button variant="outline" onClick={copyLink}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Link da Matrícula
                            </Button>
                        </div>
                    )}

                    {/* Pedagogical Link (Only if Approved) */}
                    {enrollment?.status === 'approved' && enrollment.student_id && (
                        <Button
                            variant="outline"
                            className="text-brand-600 border-brand-200 hover:bg-brand-50"
                            onClick={() => navigate(`/alunos/${enrollment.student_id}?tab=academic`)}
                        >
                            <GraduationCap className="w-4 h-4 mr-2" />
                            Perfil Pedagógico
                        </Button>
                    )}

                    <Button
                        className="bg-brand-600 hover:bg-brand-700"
                        onClick={handleApproveClick}
                        disabled={saving || enrollment?.status === 'approved'}
                    >
                        <CheckCircle className="w-4 h-4 mr-2" /> Aprovar Matrícula
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:w-48 xl:w-56 shrink-0 space-y-2">
                    {SECTIONS.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveTab(section.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-sm
                                ${activeTab === section.id
                                    ? 'bg-white text-brand-600 shadow-sm border border-brand-100'
                                    : 'text-gray-500 hover:bg-gray-100'
                                }
                            `}
                        >
                            <section.icon className="w-4 h-4" />
                            {section.label}
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    <Card className="min-h-[500px] p-5">
                        {/* Tab: Personal */}
                        {activeTab === 'personal' && (
                            <div className="space-y-8 animate-fade-in">
                                {/* Student Identity */}
                                <section className="space-y-4">
                                    <h3 className="text-md font-bold text-gray-700 flex items-center gap-2">
                                        <User className="w-4 h-4" /> Identificação do Aluno
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Nome Completo"
                                            value={formData.candidate_name}
                                            onChange={e => setFormData({ ...formData, candidate_name: e.target.value })}
                                        />
                                        <Input
                                            label="CPF do Aluno"
                                            value={details.student_cpf || ''}
                                            onChange={e => setDetails({ ...details, student_cpf: e.target.value })}
                                        />
                                        <Input
                                            label="Data de Nascimento" type="date"
                                            value={details.birth_date || ''}
                                            onChange={e => setDetails({ ...details, birth_date: e.target.value })}
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="RG"
                                                value={details.rg || ''}
                                                onChange={e => setDetails({ ...details, rg: e.target.value })}
                                            />
                                            <Input
                                                label="Órgão Emissor"
                                                value={details.rg_issuing_body || ''}
                                                onChange={e => setDetails({ ...details, rg_issuing_body: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <hr className="border-gray-100" />

                                <section className="space-y-4">
                                    <h3 className="text-md font-bold text-gray-700 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> Saúde e Cuidados
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="col-span-1">
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo Sanguíneo</label>
                                            <select
                                                className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                                value={details.blood_type || ''}
                                                onChange={e => setDetails({ ...details, blood_type: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="A+">A+</option>
                                                <option value="A-">A-</option>
                                                <option value="B+">B+</option>
                                                <option value="B-">B-</option>
                                                <option value="AB+">AB+</option>
                                                <option value="AB-">AB-</option>
                                                <option value="O+">O+</option>
                                                <option value="O-">O-</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <Input
                                                label="Alergias / Restrições"
                                                placeholder="Ex: Alergia a amendoim, intolerância a lactose..."
                                                value={details.allergies || ''}
                                                onChange={e => setDetails({ ...details, allergies: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Plano de Saúde"
                                            placeholder="Ex: Unimed, Bradesco..."
                                            value={details.health_insurance || ''}
                                            onChange={e => setDetails({ ...details, health_insurance: e.target.value })}
                                        />
                                        <Input
                                            label="Número da Carteirinha / SUS"
                                            value={details.health_insurance_number || ''}
                                            onChange={e => setDetails({ ...details, health_insurance_number: e.target.value })}
                                        />
                                    </div>
                                </section>

                                <hr className="border-gray-100" />

                                {/* Responsible Party */}
                                <section className="space-y-4">
                                    <h3 className="text-md font-bold text-gray-700 flex items-center gap-2">
                                        <User className="w-4 h-4" /> Responsável Financeiro/Pedagógico
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Nome do Responsável"
                                            value={details.parent_name || ''}
                                            onChange={e => setDetails({ ...details, parent_name: e.target.value })}
                                        />
                                        <Input
                                            label="CPF do Responsável"
                                            value={details.parent_cpf || ''}
                                            onChange={e => setDetails({ ...details, parent_cpf: e.target.value })}
                                        />
                                        <Input
                                            label="Email Principal"
                                            value={formData.parent_email}
                                            onChange={e => setFormData({ ...formData, parent_email: e.target.value })}
                                        />
                                        <Input
                                            label="Telefone / WhatsApp"
                                            value={details.parent_phone || ''}
                                            onChange={e => setDetails({ ...details, parent_phone: e.target.value })}
                                        />
                                    </div>
                                </section>

                                <hr className="border-gray-100" />

                                {/* Authorized Pickups */}
                                <section className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-md font-bold text-gray-700 flex items-center gap-2">
                                            <User className="w-4 h-4" /> Pessoas Autorizadas a Buscar
                                        </h3>
                                        <Button size="sm" variant="outline" onClick={addPickupPerson}>
                                            + Adicionar
                                        </Button>
                                    </div>

                                    {(details.authorized_pickups || []).length === 0 && (
                                        <p className="text-sm text-gray-400 italic">Nenhuma pessoa autorizada adicionada além dos responsáveis.</p>
                                    )}

                                    <div className="space-y-3">
                                        {(details.authorized_pickups || []).map((person: any, index: number) => (
                                            <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                <div className="col-span-5">
                                                    <label className="text-xs font-medium text-gray-500">Nome</label>
                                                    <input
                                                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                                                        value={person.name}
                                                        onChange={e => updatePickupPerson(index, 'name', e.target.value)}
                                                        placeholder="Nome Completo"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-xs font-medium text-gray-500">Parentesco</label>
                                                    <input
                                                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                                                        value={person.relation}
                                                        onChange={e => updatePickupPerson(index, 'relation', e.target.value)}
                                                        placeholder="Ex: Tio"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-xs font-medium text-gray-500">CPF/RG</label>
                                                    <input
                                                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                                                        value={person.cpf}
                                                        onChange={e => updatePickupPerson(index, 'cpf', e.target.value)}
                                                        placeholder="Doc. Identidade"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => removePickupPerson(index)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* Tab: Address */}
                        {activeTab === 'address' && (
                            <div className="space-y-6 animate-fade-in">
                                <h2 className="text-lg font-bold border-b pb-2">Endereço Residencial</h2>
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-3">
                                        <div className="relative">
                                            <Input
                                                label="CEP"
                                                value={details.zip_code || ''}
                                                onChange={e => setDetails({ ...details, zip_code: e.target.value })}
                                                onBlur={handleCepBlur}
                                                placeholder="00000-000"
                                                maxLength={9}
                                            />
                                            {searchingCep && (
                                                <div className="absolute right-3 top-9">
                                                    <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-12 md:col-span-6">
                                        <Input
                                            label="Logradouro"
                                            value={details.address || ''}
                                            onChange={e => setDetails({ ...details, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-3">
                                        <Input
                                            label="Número"
                                            value={details.address_number || ''}
                                            onChange={e => setDetails({ ...details, address_number: e.target.value })}
                                        />
                                    </div>

                                    <div className="col-span-12 md:col-span-4">
                                        <Input
                                            label="Bairro"
                                            value={details.neighbor || ''}
                                            onChange={e => setDetails({ ...details, neighbor: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-5">
                                        <Input
                                            label="Cidade"
                                            value={details.city || ''}
                                            onChange={e => setDetails({ ...details, city: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-3">
                                        <Input
                                            label="Estado (UF)"
                                            maxLength={2}
                                            value={details.state || ''}
                                            onChange={e => setDetails({ ...details, state: e.target.value })}
                                        />
                                    </div>

                                    <div className="col-span-12">
                                        <Input
                                            label="Complemento"
                                            placeholder="Ex: Apto 102, Bloco B"
                                            value={details.complement || ''}
                                            onChange={e => setDetails({ ...details, complement: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Docs */}
                        {activeTab === 'docs' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="border-b pb-4 mb-4">
                                    <h2 className="text-lg font-bold">Documentação Necessária</h2>
                                    <p className="text-sm text-gray-500">Faça o upload dos documentos obrigatórios. Para aprovar a matrícula, todos devem estar validados.</p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {REQUIRED_DOCS.map((docType) => {
                                        const status = getDocStatus(docType.id);

                                        return (
                                            <div key={docType.id} className={`p-4 rounded-xl border-2 transition-all ${status === 'approved' ? 'border-green-100 bg-green-50' :
                                                status === 'rejected' ? 'border-red-100 bg-red-50' :
                                                    status === 'uploaded' ? 'border-yellow-100 bg-yellow-50' :
                                                        'border-gray-100 bg-white hover:border-gray-200'
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status === 'approved' ? 'bg-green-200 text-green-700' :
                                                            status === 'rejected' ? 'bg-red-200 text-red-700' :
                                                                status === 'uploaded' ? 'bg-yellow-200 text-yellow-700' :
                                                                    'bg-gray-100 text-gray-400'
                                                            }`}>
                                                            {status === 'approved' ? <CheckCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-gray-900">{docType.label}</h4>
                                                            <p className="text-xs font-medium uppercase tracking-wider mt-0.5">
                                                                {status === 'pending' && <span className="text-gray-400">Pendente</span>}
                                                                {status === 'uploaded' && <span className="text-yellow-600">Aguardando Análise</span>}
                                                                {status === 'approved' && <span className="text-green-600">Aprovado</span>}
                                                                {status === 'rejected' && <span className="text-red-600">Rejeitado - Reenviar</span>}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {status === 'pending' || status === 'rejected' ? (
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                    onChange={(e) => handleFileUploadRequest(e, docType.id)}
                                                                    disabled={uploading}
                                                                />
                                                                <Button size="sm" variant={status === 'rejected' ? 'outline' : 'primary'} disabled={uploading}>
                                                                    <Upload className="w-4 h-4 mr-2" />
                                                                    {uploading ? 'Enviando...' : 'Enviar Arquivo'}
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <a href={getDocUrl(docType.id)} target="_blank" rel="noopener noreferrer">
                                                                    <Button size="sm" variant="ghost" title="Visualizar">
                                                                        <Download className="w-4 h-4 text-gray-600" />
                                                                    </Button>
                                                                </a>

                                                                {/* Admin Actions */}
                                                                {status === 'uploaded' && (
                                                                    <>
                                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleDocAction(docType.id, 'approve')}>
                                                                            Aprovar
                                                                        </Button>
                                                                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDocAction(docType.id, 'reject')}>
                                                                            Rejeitar
                                                                        </Button>
                                                                    </>
                                                                )}

                                                                <Button size="sm" variant="ghost" onClick={() => handleDocAction(docType.id, 'delete')}>
                                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Tab: Financial */}
                        {activeTab === 'financial' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="border-b pb-4 mb-4 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-bold">Módulo Financeiro</h2>
                                        <p className="text-sm text-gray-500">Selecione um plano para gerar o contrato e as parcelas.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Control Panel */}
                                    <div className="md:col-span-1 space-y-6">
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                                            <h3 className="font-semibold text-gray-700">Configuração de Cobrança</h3>

                                            <div>
                                                <label className="text-xs font-medium text-gray-500 mb-1 block">Plano de Pagamento</label>
                                                <select
                                                    className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                                                    value={selectedPlanId}
                                                    onChange={e => setSelectedPlanId(e.target.value)}
                                                >
                                                    <option value="">Selecione um plano...</option>
                                                    {financialPlans.map(plan => (
                                                        <option key={plan.id} value={plan.id}>
                                                            {plan.title} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.total_value)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <Button
                                                className="w-full"
                                                onClick={handleGenerateClick}
                                                disabled={!selectedPlanId || generating || installments.length > 0}
                                            >
                                                {generating ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                                                Gerar Parcelas
                                            </Button>

                                            {installments.length > 0 && (
                                                <Button
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                                    onClick={handleSaveInstallments}
                                                    disabled={saving}
                                                >
                                                    {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                                    Salvar Alterações
                                                </Button>
                                            )}

                                            {installments.length > 0 && (
                                                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs">
                                                    ⚠️ As parcelas já foram geradas. Para recriar, você deve excluir as atuais.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Installments List */}
                                    <div className="md:col-span-2">
                                        <h3 className="font-semibold text-gray-700 mb-4">Parcelas do Contrato</h3>

                                        {installments.length === 0 ? (
                                            <div className="border border-dashed border-gray-200 rounded-lg p-12 text-center text-gray-400">
                                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p>Nenhuma parcela gerada ainda.</p>
                                            </div>
                                        ) : (
                                            <div className="border border-gray-100 rounded-lg overflow-hidden">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                                        <tr>
                                                            <th className="p-3">#</th>
                                                            <th className="p-3">Vencimento</th>
                                                            <th className="p-3">Valor</th>
                                                            <th className="p-3">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {installments.map((inst, index) => (
                                                            <tr key={inst.id || index} className="hover:bg-gray-50/50">
                                                                <td className="p-3 font-medium text-gray-700">{inst.installment_number}ª</td>
                                                                <td className="p-3 text-gray-600">
                                                                    <input
                                                                        type="date"
                                                                        className="bg-transparent border border-transparent hover:border-gray-300 focus:border-brand-500 rounded px-2 py-1 outline-none w-full"
                                                                        value={inst.due_date ? String(inst.due_date).split('T')[0] : ''}
                                                                        onChange={(e) => handleUpdateInstallment(index, 'due_date', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="p-3 font-medium text-gray-900">
                                                                    <div className="flex items-center">
                                                                        <span className="text-gray-400 mr-1">R$</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            className="bg-transparent border border-transparent hover:border-gray-300 focus:border-brand-500 rounded px-2 py-1 outline-none w-full font-medium"
                                                                            value={inst.value}
                                                                            onChange={(e) => handleUpdateInstallment(index, 'value', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${inst.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                                        inst.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                                                            'bg-yellow-100 text-yellow-700'
                                                                        }`}>
                                                                        {inst.status === 'pending' ? 'Pendente' :
                                                                            inst.status === 'paid' ? 'Pago' : 'Vencido'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Contract */}
                        {activeTab === 'contract' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h2 className="text-lg font-bold border-b pb-4 mb-4">Gestão de Contrato</h2>
                                    <p className="text-sm text-gray-500 mb-6">
                                        Gere a minuta do contrato baseada nos dados financeiros ou faça o upload do contrato assinado.
                                    </p>
                                </div>

                                {/* Step 1: Upload Draft (Minuta) */}
                                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200 shadow-sm text-brand-600">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-md font-bold text-gray-900 mb-1">1. Minuta do Contrato</h3>
                                            <p className="text-sm text-gray-500 mb-4">
                                                Faça o upload do contrato (minuta) gerado para que o responsável possa baixar e assinar.
                                            </p>

                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.doc,.docx"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        disabled={uploading}
                                                        onChange={(e) => handleFileUploadRequest(e, 'contract_draft')}
                                                    />
                                                    <Button variant="outline" disabled={uploading}>
                                                        {uploading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                                        Upload da Minuta
                                                    </Button>
                                                </div>

                                                {details.documents?.['contract_draft']?.status === 'uploaded' && (
                                                    <div className="flex items-center gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                                                        <CheckCircle className="w-4 h-4" />
                                                        Minuta Disponível
                                                        <a href={getDocUrl('contract_draft')} target="_blank" rel="noreferrer" className="ml-2 underline text-blue-700">Ver Minuta</a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2: Upload Signed */}
                                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200 shadow-sm text-brand-600">
                                            <Upload className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-md font-bold text-gray-900 mb-1">2. Upload do Contrato Assinado</h3>
                                            <p className="text-sm text-gray-500 mb-4">
                                                Após a assinatura, digitalize e envie o contrato finalizado para arquivamento.
                                            </p>

                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        disabled={uploading}
                                                        onChange={(e) => handleFileUploadRequest(e, 'contract_signed')}
                                                    />
                                                    <Button className="bg-brand-600 hover:bg-brand-700" disabled={uploading}>
                                                        {uploading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                                        Enviar Contrato Assinado
                                                    </Button>
                                                </div>

                                                {details.documents?.['contract_signed']?.status === 'uploaded' && (
                                                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                                                        <CheckCircle className="w-4 h-4" />
                                                        Contrato Recebido
                                                        <a href={getDocUrl('contract_signed')} target="_blank" rel="noreferrer" className="ml-2 underline text-green-700">Ver Arquivo</a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div >

            {/* Tab: Academic (Boletim) */}
            {
                activeTab === 'academic' && (
                    <Card className="min-h-[500px] p-5">
                        <div className="space-y-6 animate-fade-in">
                            <div className="border-b pb-4 mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <GraduationCap className="w-5 h-5 text-brand-600" />
                                    Boletim Escolar
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Notas e avaliações referentes a este contrato de matrícula.
                                </p>
                            </div>

                            {enrollmentGrades.length === 0 ? (
                                <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center">
                                    <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                                        <GraduationCap className="w-8 h-8 text-brand-500" />
                                    </div>
                                    <p className="text-gray-900 font-semibold text-lg">Boletim Vazio</p>
                                    <p className="text-sm text-gray-500 max-w-sm mt-1">
                                        Nenhuma avaliação foi lançada para este contrato ainda. Assim que os professores lançarem, elas aparecerão aqui.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Group by Term */}
                                    {['1_bimestre', '2_bimestre', '3_bimestre', '4_bimestre'].map(term => {
                                        const termGrades = enrollmentGrades.filter(g => g.grade_book?.term === term);

                                        const termLabels: any = {
                                            '1_bimestre': '1º Bimestre',
                                            '2_bimestre': '2º Bimestre',
                                            '3_bimestre': '3º Bimestre',
                                            '4_bimestre': '4º Bimestre'
                                        };

                                        return (
                                            <div key={term} className={`border rounded-xl overflow-hidden flex flex-col transition-all duration-200 ${termGrades.length > 0 ? 'bg-white border-gray-200 shadow-sm hover:shadow-md' : 'bg-gray-50 border-gray-100 border-dashed opacity-70'
                                                }`}>
                                                <div className={`px-4 py-3 border-b font-semibold flex justify-between items-center ${termGrades.length > 0 ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-transparent border-gray-100 text-gray-400'
                                                    }`}>
                                                    <span>{termLabels[term]}</span>
                                                    <span className="text-xs font-normal opacity-70">
                                                        {termGrades.length} avaliações
                                                    </span>
                                                </div>

                                                {termGrades.length > 0 ? (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="text-xs text-gray-500 bg-white border-b border-gray-100 uppercase tracking-wider">
                                                                <tr>
                                                                    <th className="px-4 py-2 font-medium">Atividade</th>
                                                                    <th className="px-4 py-2 text-center font-medium">Nota</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-50">
                                                                {termGrades.map((grade: any) => (
                                                                    <tr key={grade.id} className="hover:bg-gray-50 transition-colors">
                                                                        <td className="px-4 py-3">
                                                                            <div className="font-medium text-gray-900 line-clamp-1" title={grade.grade_book?.title}>
                                                                                {grade.grade_book?.title}
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                                                <span className="uppercase tracking-widest text-[10px] bg-gray-100 px-1 rounded">
                                                                                    {grade.grade_book?.subject?.slice(0, 3) || 'GEN'}
                                                                                </span>
                                                                                <span className="line-clamp-1">{grade.grade_book?.subject || 'Geral'}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className="flex flex-col items-center">
                                                                                <span className={`font-bold text-sm px-2.5 py-0.5 rounded-full ${(grade.score / grade.grade_book?.max_score) >= 0.6
                                                                                    ? 'bg-green-100 text-green-700'
                                                                                    : 'bg-red-100 text-red-700'
                                                                                    }`}>
                                                                                    {Number(grade.score).toFixed(1)}
                                                                                </span>
                                                                                <span className="text-[10px] text-gray-400 mt-1">
                                                                                    de {grade.grade_book?.max_score}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="p-6 text-center text-gray-400 text-sm italic">
                                                        Sem notas neste período
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </Card>
                )
            }

            <Modal
                isOpen={showApproveModal}
                onClose={() => setShowApproveModal(false)}
                title="Aprovar Matrícula e Criar Aluno"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowApproveModal(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={performApproval} disabled={saving}>
                            {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            {saving ? 'Processando...' : 'Confirmar Aprovação'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                        <div className="text-yellow-600">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-yellow-800 text-sm">Atenção!</h4>
                            <p className="text-sm text-yellow-700 mt-1">
                                Esta ação irá transformar a matrícula em um <strong>Aluno Oficial</strong>.
                            </p>
                        </div>
                    </div>
                    <p className="text-gray-600">
                        Verifique se todos os documentos obrigatórios foram validados e se os dados financeiros estão corretos.
                    </p>
                    <ul className="list-disc pl-5 text-sm text-gray-500 space-y-1">
                        <li>O status da matrícula mudará para <strong>Aprovado</strong>.</li>
                        <li>Um novo registro será criado na tabela de Alunos.</li>
                        <li>O responsável receberá o status de confirmação (futuro).</li>
                    </ul>
                </div>
            </Modal>

            {/* Success Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => { }} // Force user to click the action button
                title=""
                footer={
                    <div className="w-full flex justify-center">
                        <Button className="bg-brand-600 hover:bg-brand-700 w-full md:w-auto min-w-[200px]" onClick={() => navigate('/matriculas')}>
                            Voltar para Lista
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col items-center justify-center text-center py-6 space-y-4 w-full">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2 animate-bounce">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Matrícula Aprovada!</h2>
                    <p className="text-gray-600 max-w-md">
                        O aluno foi cadastrado com sucesso e agora faz parte do corpo discente oficial.
                    </p>
                    {createdStudentId && (
                        <div className="w-full max-w-sm bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4 text-left">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <User className="w-4 h-4" /> Acesso do Responsável
                            </h4>
                            <p className="text-xs text-gray-500 mb-3">
                                Utilize a função "Criar Acesso" no topo da matrícula para gerar as credenciais do pai.
                            </p>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Financial Confirm Modal */}
            <Modal
                isOpen={showFinancialConfirmModal}
                onClose={() => setShowFinancialConfirmModal(false)}
                title="Gerar Parcelas"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowFinancialConfirmModal(false)} disabled={generating}>
                            Cancelar
                        </Button>
                        <Button className="bg-brand-600 hover:bg-brand-700" onClick={handleGenerateInstallments} disabled={generating}>
                            {generating ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                            {generating ? 'Gerando...' : 'Confirmar Geração'}
                        </Button>
                    </>
                }
            >
                <div>
                    <p className="text-gray-600 mb-4">
                        Você está prestes a gerar as parcelas para esta matrícula com base no plano selecionado.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                        <p className="font-medium mb-1">Detalhes do Plano:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Isso substituirá quaisquer parcelas existentes para esta matrícula.</li>
                            <li>Após gerar, você poderá ajustar as datas e valores individualmente.</li>
                        </ul>
                    </div>
                </div>
            </Modal>





            {/* Manual Access Modal */}
            {
                showManualAccess && enrollment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl relative overflow-hidden">
                            <button
                                onClick={() => setShowManualAccess(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                            <ParentAccessGenerator
                                studentId={enrollment.student_id}
                                studentName={enrollment.candidate_name}
                                responsibleEmail={enrollment.parent_email}
                                responsibleName={details?.parent_name}
                                onClose={() => setShowManualAccess(false)}
                                onSuccess={() => {
                                    setShowManualAccess(false);
                                    if (enrollment.student_id) {
                                        fetchGuardians(enrollment.student_id);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )
            }

            {/* Guardian Management Modal */}
            {
                showGuardianModal && enrollment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl relative overflow-hidden">
                            <button
                                onClick={() => setShowGuardianModal(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>

                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                                    <Users className="w-6 h-6 text-brand-600" />
                                    Gerenciar Acessos
                                </h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Responsáveis com acesso ao portal do aluno <strong>{enrollment.candidate_name}</strong>
                                </p>

                                {/* Guardian List */}
                                <div className="space-y-3 mb-6">
                                    {guardians.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic text-center py-4">
                                            Nenhum responsável vinculado ainda.
                                        </p>
                                    ) : (
                                        guardians.map((guardian: any) => {
                                            const profile = guardian.profiles;
                                            return (
                                                <div
                                                    key={guardian.guardian_id}
                                                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100"
                                                >
                                                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold">
                                                        {profile.name?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-gray-900 truncate">{profile.name || 'Sem nome'}</p>
                                                        <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                                        <span className="text-xs text-green-600 font-medium">Ativo</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Add New Guardian Button */}
                                <Button
                                    onClick={() => {
                                        setShowGuardianModal(false);
                                        setShowManualAccess(true);
                                    }}
                                    variant="outline"
                                    className="w-full border-2 border-dashed border-brand-300 text-brand-700 hover:bg-brand-50"
                                >
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Adicionar Novo Responsável
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="mt-12 border-t border-gray-200 pt-8 animate-fade-in">
                <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center">
                    <Shield className="w-5 h-5 mr-2" /> Zona de Perigo
                </h3>
                <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                    <h4 className="font-bold text-red-900 mb-2">Cancelar Matrícula</h4>
                    <p className="text-sm text-red-700 mb-6 max-w-2xl">
                        O cancelamento de uma matrícula revoga o acesso do responsável e marca o registro como inativo.
                        Se o aluno foi transferido, selecione a opção apropriada para atualizar o status do aluno também.
                    </p>

                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800"
                            onClick={async () => {
                                const reason = prompt("Por favor, informe o motivo do cancelamento (Ex: Desistência, Erro de cadastro):");
                                if (!reason) return;

                                if (!confirm("Tem certeza? Esta ação não pode ser desfeita facilmente.")) return;

                                setLoading(true);
                                try {
                                    const { error } = await supabase
                                        .from('enrollments')
                                        .update({
                                            status: 'cancelled',
                                            details: {
                                                ...details,
                                                cancellation_reason: reason,
                                                cancelled_at: new Date().toISOString()
                                            }
                                        })
                                        .eq('id', id);

                                    if (error) throw error;
                                    alert("Matrícula cancelada.");
                                    navigate('/matriculas');
                                } catch (e: any) {
                                    alert("Erro: " + e.message);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        >
                            Cancelar Matrícula
                        </Button>

                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20"
                            onClick={async () => {
                                const reason = prompt("Informe o motivo da transferência/saída:");
                                if (!reason) return;

                                if (!confirm("Isso também marcará o ALUNO como 'Transferido/Inativo'. Confirmar?")) return;

                                setLoading(true);
                                try {
                                    // 1. Cancel Enrollment
                                    const { error: enrollError } = await supabase
                                        .from('enrollments')
                                        .update({
                                            status: 'cancelled',
                                            details: {
                                                ...details,
                                                cancellation_reason: 'TRANSFERÊNCIA: ' + reason,
                                                cancelled_at: new Date().toISOString()
                                            }
                                        })
                                        .eq('id', id);

                                    if (enrollError) throw enrollError;

                                    // 2. Update Student Context (if exists)
                                    if (enrollment?.student_id) {
                                        const { error: studentError } = await supabase
                                            .from('students')
                                            .update({ status: 'transferred' }) // Ensure this status is valid in your constraints/types
                                            .eq('id', enrollment.student_id);

                                        if (studentError) throw studentError;
                                    }

                                    alert("Matrícula cancelada e Aluno transferido.");
                                    navigate('/matriculas');
                                } catch (e: any) {
                                    alert("Erro: " + e.message);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        >
                            Registrar Transferência
                        </Button>
                    </div>
                </div>
            </div>
        </div >
    );
};
