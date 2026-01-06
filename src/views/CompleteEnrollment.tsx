
import { type FC, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button, Card, Input } from '../components/ui';
import {
    Loader2, CheckCircle, Upload, Clock,
    FileWarning, RefreshCw, Trash2
} from 'lucide-react';


export const CompleteEnrollmentView: FC = () => {
    const { token } = useParams<{ token: string }>();

    // State
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1); // Wizard Steps
    const [enrollment, setEnrollment] = useState<any>(null);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);

    // Portal Logic
    const isDraft = enrollment?.status === 'draft';
    const isApproved = enrollment?.status === 'approved' || enrollment?.status === 'completed';
    // Check for rejected documents regardless of enrollment status (unless approved)
    const rejectedDocs = enrollment?.details?.documents ?
        Object.entries(enrollment.details.documents).filter(([_, doc]: any) => doc.status === 'rejected') : [];
    const hasIssues = rejectedDocs.length > 0 && !isApproved;

    // Derived Mode
    // If Draft -> Wizard
    // If Approved -> Success
    // If Issues -> Action Required
    // Else -> Under Analysis
    const mode = isDraft ? 'wizard' : isApproved ? 'success' : hasIssues ? 'action_required' : 'analysis';

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
        if (!e.target.files || e.target.files.length === 0 || !enrollment) return;
        const file = e.target.files[0];

        // 1. Validation: File Size (Max 5MB)
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_SIZE) {
            alert('Arquivo muito grande! O tamanho máximo permitido é 5MB.');
            e.target.value = ''; // Reset input
            return;
        }

        // 2. Validation: File Type (Images or PDF)
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!ALLOWED_TYPES.includes(file.type)) {
            alert('Formato inválido! Permitido apenas imagens (JPG, PNG) ou PDF.');
            e.target.value = ''; // Reset input
            return;
        }

        setUploading(true);
        const filePath = `enrollments/${enrollment.id}/${docId}_${file.name}`;

        try {
            // 1. Upload
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Update Details
            const newDocMetadata = {
                status: 'uploaded', // Reset status to uploaded (pending review)
                file_path: filePath,
                file_name: file.name,
                uploaded_at: new Date().toISOString()
            };

            const newDetails = {
                ...(enrollment.details || {}),
                documents: {
                    ...(enrollment.details?.documents || {}),
                    [docId]: newDocMetadata
                }
            };

            await supabase.from('enrollments').update({ details: newDetails }).eq('id', enrollment.id);

            // Update local state
            setEnrollment({ ...enrollment, details: newDetails });

            // 3. Notify Admin
            await supabase.rpc('create_admin_notification', {
                p_title: 'Documento Reenviado',
                p_message: `O responsável reenviou o documento: ${docId}`,
                p_link: `/matriculas/${enrollment.id}`,
                p_enrollment_id: enrollment.id
            });

        } catch (error: any) {
            console.error(error);
            alert('Erro no upload: ' + error.message);
        } finally {
            setUploading(false);
        }
    };


    // Form Data Helpers
    const [formData, setFormData] = useState<any>({
        student_name: '',
        student_cpf: '',
        birth_date: '',
        rg: '',
        rg_issuing_body: '',
        blood_type: '',
        allergies: '',
        health_insurance: '',
        health_insurance_number: '',

        parent_name: '',
        parent_cpf: '',
        parent_rg: '',
        parent_email: '',
        phone: '',

        zip_code: '',
        address: '',
        address_number: '',
        neighbor: '',
        city: '',
        state: '',
        complement: '',

        authorized_pickups: []
    });

    useEffect(() => {
        const fetchEnrollment = async () => {
            if (!token) return;
            try {
                const { data, error } = await supabase
                    .from('enrollments')
                    .select('*')
                    .eq('invite_token', token)
                    .single();

                if (error || !data) throw new Error('Convite inválido ou expirado.');

                setEnrollment(data);

                // Map database details to form structure
                // Priority: Existing details > Defaults
                const details = data.details || {};

                setFormData({
                    student_name: data.candidate_name,
                    student_cpf: details.student_cpf || '',
                    birth_date: details.birth_date || '',
                    rg: details.rg || '',
                    rg_issuing_body: details.rg_issuing_body || '',
                    blood_type: details.blood_type || '',
                    allergies: details.allergies || '',
                    health_insurance: details.health_insurance || '',
                    health_insurance_number: details.health_insurance_number || '',

                    parent_name: data.parent_name || details.parent_name || '',
                    parent_cpf: details.parent_cpf || '',
                    parent_rg: details.parent_rg || '',
                    parent_email: data.parent_email || details.parent_email,
                    phone: data.parent_phone || details.parent_phone || '',

                    zip_code: details.zip_code || '',
                    address: details.address || '',
                    address_number: details.address_number || '',
                    neighbor: details.neighbor || '',
                    city: details.city || '',
                    state: details.state || '',
                    complement: details.complement || '',

                    authorized_pickups: details.authorized_pickups || []
                });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchEnrollment();
    }, [token]);


    // Pickup Handlers
    const addPickupPerson = () => {
        setFormData((prev: any) => ({
            ...prev,
            authorized_pickups: [...(prev.authorized_pickups || []), { name: '', relation: '', cpf: '' }]
        }));
    };

    const removePickupPerson = (index: number) => {
        setFormData((prev: any) => {
            const newPickups = [...(prev.authorized_pickups || [])];
            newPickups.splice(index, 1);
            return { ...prev, authorized_pickups: newPickups };
        });
    };

    const updatePickupPerson = (index: number, field: string, value: string) => {
        setFormData((prev: any) => {
            const newPickups = [...(prev.authorized_pickups || [])];
            newPickups[index] = { ...newPickups[index], [field]: value };
            return { ...prev, authorized_pickups: newPickups };
        });
    };

    // Unified Save Function
    const handleSave = async (finalize = false) => {
        setLoading(true);
        try {
            // Check required fields for final submission
            if (finalize) {
                if (!formData.parent_name || !formData.parent_cpf) {
                    throw new Error('Preencha os dados do responsável antes de finalizar.');
                }
            }

            const newDetails = {
                ...(enrollment?.details || {}), // Keep existing details

                // Merge FormData
                student_cpf: formData.student_cpf,
                birth_date: formData.birth_date,
                rg: formData.rg,
                rg_issuing_body: formData.rg_issuing_body,
                blood_type: formData.blood_type,
                allergies: formData.allergies,
                health_insurance: formData.health_insurance,
                health_insurance_number: formData.health_insurance_number,

                parent_name: formData.parent_name,
                parent_cpf: formData.parent_cpf,
                parent_rg: formData.parent_rg,
                parent_phone: formData.phone,
                parent_email: formData.parent_email, // Also save in details just in case

                zip_code: formData.zip_code,
                address: formData.address,
                address_number: formData.address_number,
                neighbor: formData.neighbor,
                city: formData.city,
                state: formData.state,
                complement: formData.complement,

                authorized_pickups: formData.authorized_pickups
            };

            const payload: any = {
                candidate_name: formData.student_name,
                parent_name: formData.parent_name,
                parent_email: formData.parent_email,
                details: newDetails,
                updated_at: new Date().toISOString()
            };

            // If finalizing, set status to 'sent'
            if (finalize && mode === 'wizard') {
                payload.status = 'sent';
            }

            const { error: updateError } = await supabase
                .from('enrollments')
                .update(payload)
                .eq('id', enrollment.id);

            if (updateError) throw updateError;

            // Success feedback
            if (finalize) {
                // Force reload to show 'analysis' mode
                window.location.reload();
            } else {
                // Silent save or specific feedback if needed, but for 'next' usually we just proceed
            }

        } catch (err: any) {
            console.error(err);
            alert('Erro ao salvar: ' + err.message);
            // If finalize failed, we don't reload, so user stays on step 3
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        await handleSave(false); // Just save data
        if (step < 3) setStep(step + 1);
    };

    const handleSubmit = async () => {
        await handleSave(true); // Save + Finalize
    };

    const handleBack = () => setStep(step - 1);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center text-red-600 p-4 text-center">{error}</div>;

    // View: Success (Approved/Completed)
    if (mode === 'success') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-lg w-full p-8 text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Matrícula Concluída!</h1>
                        <p className="text-gray-500 mt-2">
                            Parabéns! A matrícula do aluno(a) <span className="font-semibold text-gray-900">{enrollment.candidate_name}</span> foi aprovada e finalizada.
                        </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                        Você receberá em breve o acesso ao Portal do Responsável.
                    </div>
                </Card>
            </div>
        );
    }

    // View: Analysis (Sent)
    if (mode === 'analysis') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-lg w-full p-8 text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Clock className="w-8 h-8 text-yellow-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Em Análise</h1>
                        <p className="text-gray-500 mt-2">
                            Recebemos seus dados e documentos. Nossa equipe está analisando as informações do aluno(a) <span className="font-semibold text-gray-900">{enrollment.candidate_name}</span>.
                        </p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800 border-l-4 border-yellow-400 text-left">
                        <p className="font-bold mb-1">Próximos passos:</p>
                        <ul className="list-disc ml-4 space-y-1">
                            <li>Análise da documentação (até 2 dias úteis)</li>
                            <li>Emissão do contrato</li>
                            <li>Liberação do boleto</li>
                        </ul>
                    </div>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Atualizar Status
                    </Button>
                </Card>
            </div>
        );
    }

    // View: Action Required (Rejected Docs)
    if (mode === 'action_required') {
        return (
            <div className="min-h-screen bg-gray-50 p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    <Card className="p-6 border-l-4 border-red-500">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-100 rounded-full">
                                <FileWarning className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Ação Necessária</h1>
                                <p className="text-gray-600 mt-1">Alguns documentos precisam ser reenviados para prosseguir com a matrícula.</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="text-lg font-bold mb-4">Documentos Reprovados</h2>
                        <div className="space-y-4">
                            {rejectedDocs.map(([docId, doc]: any) => (
                                <div key={docId} className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold text-red-800 capitalize">
                                            {docId.replace(/_/g, ' ')}
                                        </h3>
                                        <span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full font-bold">
                                            Reprovado
                                        </span>
                                    </div>
                                    <p className="text-sm text-red-700 mb-3">
                                        <strong>Motivo:</strong> {doc.rejection_reason || 'Documento ilegível ou incorreto.'}
                                    </p>

                                    <div className="flex items-center gap-4 mt-4">
                                        <div className="relative">
                                            <input
                                                type="file"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={(e) => handleFileUpload(e, docId)}
                                                disabled={uploading}
                                            />
                                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={uploading}>
                                                <Upload className="w-4 h-4 mr-2" />
                                                {uploading ? 'Enviando...' : 'Reenviar Documento'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    // Default: Wizard Mode (Draft)
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                <div className="mb-8 text-center flex flex-col items-center">
                    <img src="/logo_school.png" alt="Logo Escola" className="h-16 mb-4 object-contain" />
                    <h1 className="text-3xl font-bold text-gray-900">Matrícula Online</h1>
                    <p className="text-gray-500">Complete os dados para finalizar a matrícula de {enrollment.candidate_name}</p>
                </div>

                <div className="flex gap-4 mb-8 justify-center">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${step >= i ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                            {i}
                        </div>
                    ))}
                </div>

                <Card className="p-8 shadow-lg">
                    <form onSubmit={(e) => { e.preventDefault(); if (step === 3) handleSubmit(); else handleNext(); }}>

                        {step === 1 && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="text-xl font-semibold border-b pb-2">1. Dados do Aluno</h3>

                                <div className="space-y-4">
                                    <Input label="Nome Completo" value={formData.student_name} onChange={e => setFormData({ ...formData, student_name: e.target.value })} />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="CPF" value={formData.student_cpf || ''} onChange={e => setFormData({ ...formData, student_cpf: e.target.value })} />
                                        <Input label="Data de Nascimento" type="date" value={formData.birth_date} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="RG" value={formData.rg || ''} onChange={e => setFormData({ ...formData, rg: e.target.value })} />
                                        <Input label="Órgão Emissor" value={formData.rg_issuing_body || ''} onChange={e => setFormData({ ...formData, rg_issuing_body: e.target.value })} />
                                    </div>
                                </div>

                                <h3 className="text-xl font-semibold border-b pb-2 mt-6">Saúde</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo Sanguíneo</label>
                                            <select
                                                className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                                value={formData.blood_type || ''}
                                                onChange={e => setFormData({ ...formData, blood_type: e.target.value })}
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
                                            <Input label="Alergias / Restrições" placeholder="Nenhuma" value={formData.allergies || ''} onChange={e => setFormData({ ...formData, allergies: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="Plano de Saúde" value={formData.health_insurance || ''} onChange={e => setFormData({ ...formData, health_insurance: e.target.value })} />
                                        <Input label="Carteirinha / SUS" value={formData.health_insurance_number || ''} onChange={e => setFormData({ ...formData, health_insurance_number: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="text-xl font-semibold border-b pb-2">2. Endereço e Responsáveis</h3>

                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-700">Responsável Financeiro / Pedagógico</h4>
                                    <Input label="Nome Completo" value={formData.parent_name} onChange={e => setFormData({ ...formData, parent_name: e.target.value })} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="CPF" value={formData.parent_cpf || ''} onChange={e => setFormData({ ...formData, parent_cpf: e.target.value })} />
                                        <Input label="RG" value={formData.parent_rg || ''} onChange={e => setFormData({ ...formData, parent_rg: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="Email" type="email" value={formData.parent_email} onChange={e => setFormData({ ...formData, parent_email: e.target.value })} />
                                        <Input label="WhatsApp" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>

                                <div className="space-y-4 mt-6">
                                    <h4 className="font-medium text-gray-700">Endereço Residencial</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <Input className="col-span-1" label="CEP" value={formData.zip_code} onChange={e => setFormData({ ...formData, zip_code: e.target.value })} />
                                        <Input className="col-span-2" label="Logradouro" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <Input label="Número" value={formData.address_number || ''} onChange={e => setFormData({ ...formData, address_number: e.target.value })} />
                                        <Input className="col-span-2" label="Bairro" value={formData.neighbor || ''} onChange={e => setFormData({ ...formData, neighbor: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-12 gap-4">
                                        <div className="col-span-12 md:col-span-6">
                                            <Input label="Cidade" value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                                        </div>
                                        <div className="col-span-12 md:col-span-2">
                                            <Input label="UF" maxLength={2} value={formData.state || ''} onChange={e => setFormData({ ...formData, state: e.target.value })} />
                                        </div>
                                        <div className="col-span-12 md:col-span-4">
                                            <Input label="Complemento" value={formData.complement || ''} onChange={e => setFormData({ ...formData, complement: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 mt-6 border-t pt-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-medium text-gray-700">Pessoas Autorizadas a Buscar</h4>
                                        <Button type="button" size="sm" variant="outline" onClick={addPickupPerson}>+ Adicionar</Button>
                                    </div>

                                    {(formData.authorized_pickups || []).length === 0 && (
                                        <p className="text-sm text-gray-400 italic">Nenhuma pessoa autorizada adicionada além dos responsáveis.</p>
                                    )}

                                    <div className="space-y-3">
                                        {(formData.authorized_pickups || []).map((person: any, index: number) => (
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
                                                        placeholder="Doc. ID"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => removePickupPerson(index)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="text-xl font-semibold border-b pb-2">3. Documentos Obrigatórios</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {/* REQUIRED DOCS from Admin View */}
                                    {[
                                        { id: 'student_id', label: 'Certidão de Nascimento / RG do Aluno' },
                                        { id: 'parent_id', label: 'RG / CPF do Responsável' },
                                        { id: 'residency', label: 'Comprovante de Residência' },
                                        { id: 'vaccination', label: 'Carteira de Vacinação' },
                                        { id: 'transfer', label: 'Declaração de Transferência / Histórico' },
                                        { id: 'photo', label: 'Foto 3x4 do Aluno' },
                                        // Keeping contract_signed if it was intentional, or removing if it's duplicative.
                                        // Usually contract is signed digitally separately, but let's keep it as an optional or valid doc if the user had it.
                                        // Adding it at the end if needed, but for now matching the admin list is safer + contract which was there.
                                    ].map((docType) => {
                                        const docKey = docType.id;
                                        const docStatus = enrollment?.details?.documents?.[docKey]?.status;
                                        const isCompleted = docStatus === 'uploaded' || docStatus === 'approved';

                                        return (
                                            <div key={docKey} className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors relative ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    onChange={(e) => handleFileUpload(e, docKey)}
                                                    disabled={uploading}
                                                />
                                                {isCompleted ? (
                                                    <>
                                                        <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
                                                        <p className="text-sm font-bold text-green-700">
                                                            {docStatus === 'approved' ? 'Documento Aprovado' : 'Arquivo Enviado'}
                                                        </p>
                                                        <p className="text-xs text-green-600">{docType.label}</p>
                                                        <p className="text-[10px] text-gray-400 mt-2">(Clique para substituir se necessário)</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        {uploading ? <Loader2 className="w-8 h-8 mx-auto text-brand-400 animate-spin mb-2" /> : <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />}
                                                        <p className="text-sm font-medium text-gray-700">Clique para enviar: {docType.label}</p>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="pt-8 flex justify-between">
                            {step > 1 ? (
                                <Button type="button" variant="ghost" onClick={handleBack}>Voltar</Button>
                            ) : <div></div>}

                            <Button type="submit">
                                {step === 3 ? 'Finalizar Matrícula' : 'Próximo Passo'}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};
