import { type FC, useState, useEffect, useCallback } from 'react';
import {
    CreditCard, FileText, CheckCircle2, AlertCircle,
    Calendar, Copy, Barcode, ChevronDown, ChevronUp, Download, Handshake
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useStudent } from '../../contexts/StudentContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Installment {
    id: string;
    enrollment_id: string;
    installment_number: number;
    value: number;
    due_date: string;
    status: 'pending' | 'overdue' | 'paid' | 'cancelled';
    paid_at?: string;
    metadata?: {
        pix_key?: string;
        boleto_code?: string;
        boleto_url?: string;
    };
    discount_value?: number;
    surcharge_value?: number;
    original_value?: number;
    negotiation_date?: string;
    negotiation_notes?: string;
}

type TabType = 'open' | 'history';

const FinancialSkeleton = () => (
    <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-white rounded-xl border border-gray-100"></div>
        <div className="space-y-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-white rounded-xl border border-gray-100"></div>
            ))}
        </div>
    </div>
);

export const ParentFinancial: FC = () => {
    const { selectedStudent } = useStudent();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('open');
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    useEffect(() => {
        if (selectedStudent) {
            fetchAvailableYears();
        }
    }, [selectedStudent]);

    useEffect(() => {
        if (selectedYear) {
            fetchFinancials();
        }
    }, [selectedYear]);

    const fetchAvailableYears = async () => {
        if (!selectedStudent) return;

        try {
            // Fetch all approved enrollments for this student
            const { data, error } = await supabase
                .from('enrollments')
                .select('id, academic_year')
                .eq('student_id', selectedStudent.id)
                .eq('status', 'approved')
                .order('academic_year', { ascending: false });

            if (error) throw error;

            const years = data?.map(e => e.academic_year) || [];
            setAvailableYears(years);
            // Default to current year from context
            setSelectedYear(selectedStudent.academic_year);
        } catch (err) {
            console.error('Error fetching years:', err);
        }
    };

    const fetchFinancials = useCallback(async () => {
        if (!selectedStudent || !selectedYear) return;

        try {
            setLoading(true);

            // Get enrollment ID for selected year
            const { data: enrollmentData, error: enrollmentError } = await supabase
                .from('enrollments')
                .select('id')
                .eq('student_id', selectedStudent.id)
                .eq('academic_year', selectedYear)
                .eq('status', 'approved')
                .maybeSingle();

            if (enrollmentError) throw enrollmentError;
            if (!enrollmentData) {
                setInstallments([]);
                setLoading(false);
                return;
            }

            // Fetch installments for this enrollment
            const { data, error } = await supabase
                .from('installments')
                .select('*')
                .eq('enrollment_id', enrollmentData.id)
                .eq('is_published', true)
                .order('due_date', { ascending: false });

            if (error) throw error;
            setInstallments(data || []);
        } catch (err) {
            console.error('Error fetching financials:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedStudent, selectedYear]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const openItems = installments.filter(i =>
        i.status === 'pending' || i.status === 'overdue'
    ).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()); // Soonest first

    const historyItems = installments.filter(i =>
        i.status === 'paid' || i.status === 'cancelled'
    ).sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()); // Recent first

    const displayedItems = activeTab === 'open' ? openItems : historyItems;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'overdue': return 'text-red-600 bg-red-50 border-red-100';
            case 'pending': return 'text-amber-600 bg-amber-50 border-amber-100';
            case 'paid': return 'text-green-600 bg-green-50 border-green-100';
            default: return 'text-gray-600 bg-gray-50 border-gray-100';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'overdue': return 'Em Atraso';
            case 'pending': return 'Aberto';
            case 'paid': return 'Pago';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(val);
    };

    const StatusBadge = ({ status }: { status: string }) => (
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getStatusColor(status)}`}>
            {getStatusLabel(status)}
        </span>
    );

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div>
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <CreditCard className="w-6 h-6 text-brand-600" />
                            Financeiro
                        </h1>
                        <p className="text-gray-600 text-sm">Gerencie mensalidades e pagamentos</p>
                    </div>

                    {/* Year Selector */}
                    {availableYears.length > 1 && (
                        <select
                            value={selectedYear || ''}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Highlights (Only visible in 'open' tab) */}
            {activeTab === 'open' && !loading && openItems.length > 0 && (
                <div className={`p-4 rounded-xl border shadow-sm ${openItems[0].status === 'overdue'
                    ? 'bg-red-50 border-red-100'
                    : 'bg-white border-gray-100'
                    }`}>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className={`text-sm font-medium ${openItems[0].status === 'overdue' ? 'text-red-800' : 'text-gray-500'}`}>
                                {openItems[0].status === 'overdue' ? 'Fatura em Atraso' : 'Próximo Vencimento'}
                            </p>
                            <h3 className={`text-2xl font-bold ${openItems[0].status === 'overdue' ? 'text-red-900' : 'text-gray-900'}`}>
                                {formatCurrency(openItems[0].value)}
                            </h3>
                        </div>
                        <div className={`p-2 rounded-full ${openItems[0].status === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
                            {openItems[0].status === 'overdue' ? <AlertCircle className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm opacity-80">
                        <span>Vence em:</span>
                        <span className="font-semibold">
                            {format(parseISO(openItems[0].due_date), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-gray-100/50 p-1 rounded-xl flex gap-1">
                <button
                    onClick={() => setActiveTab('open')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'open'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Em Aberto
                    {openItems.length > 0 && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${openItems.some(i => i.status === 'overdue') ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'}`}>
                            {openItems.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'history'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Histórico
                </button>
            </div>

            {/* List */}
            {loading ? (
                <FinancialSkeleton />
            ) : displayedItems.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                    <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-gray-900 font-medium">Tudo limpo por aqui</h3>
                    <p className="text-gray-500 text-sm">
                        {activeTab === 'open'
                            ? 'Nenhuma fatura pendente no momento.'
                            : 'Nenhum histórico de pagamento encontrado.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {displayedItems.map(item => (
                        <div
                            key={item.id}
                            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
                        >
                            {/* Card Header */}
                            <div className="p-4" onClick={() => toggleExpand(item.id)}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-3 items-center">
                                        <div className={`p-2 rounded-lg ${item.negotiation_date ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500'}`}>
                                            {item.negotiation_date ? <Handshake className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <span className="text-xs font-medium text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                                                Mensalidade {item.installment_number}
                                                {item.negotiation_date && (
                                                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                        RENEGOCIADO
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-900">
                                                {format(new Date(item.due_date + 'T12:00:00'), "MMMM 'de' yyyy", { locale: ptBR })}
                                            </span>
                                        </div>
                                    </div>
                                    <StatusBadge status={item.status} />
                                </div>

                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-0.5">Valor atual</p>
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-lg font-bold text-gray-900">{formatCurrency(item.value)}</p>
                                            {/* Show old value strikethrough if different */}
                                            {item.original_value && item.original_value !== item.value && (
                                                <span className="text-xs text-gray-400 line-through">
                                                    {formatCurrency(item.original_value)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick Actions (Open Tab) */}
                                    {activeTab === 'open' && (
                                        <div className="flex gap-2">
                                            {item.metadata?.pix_key && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(item.metadata!.pix_key!, item.id);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg text-xs font-medium hover:bg-brand-100 transition-colors"
                                                >
                                                    {copiedId === item.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                    {copiedId === item.id ? 'Copiado!' : 'PIX'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Expandable Details */}
                            {expandedId === item.id && (
                                <div className="px-4 pb-4 pt-0 border-t border-gray-50 bg-gray-50/50">
                                    <div className="pt-4 space-y-4">

                                        {/* Financial Breakdown */}
                                        <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2 text-sm">
                                            <div className="flex justify-between items-center text-gray-500">
                                                <span>Valor Original</span>
                                                <span>{formatCurrency(item.original_value || item.value)}</span>
                                            </div>

                                            {(item.discount_value || 0) > 0 && (
                                                <div className="flex justify-between items-center text-green-600">
                                                    <span className="flex items-center gap-1">Desconto</span>
                                                    <span>- {formatCurrency(item.discount_value!)}</span>
                                                </div>
                                            )}

                                            {(item.surcharge_value || 0) > 0 && (
                                                <div className="flex justify-between items-center text-red-600">
                                                    <span>Juros / Multa</span>
                                                    <span>+ {formatCurrency(item.surcharge_value!)}</span>
                                                </div>
                                            )}

                                            <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between items-center font-bold text-gray-900">
                                                <span>Total a Pagar</span>
                                                <span>{formatCurrency(item.value)}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <p className="text-gray-500">Vencimento</p>
                                                <p className="font-medium text-gray-900">{format(parseISO(item.due_date), "dd/MM/yyyy")}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Pagamento</p>
                                                <p className="font-medium text-gray-900">
                                                    {item.paid_at ? format(parseISO(item.paid_at), "dd/MM/yyyy") : '-'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Renegotiation Details */}
                                        {item.negotiation_date && (
                                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
                                                <div className="flex items-center gap-2 font-bold mb-1">
                                                    <Handshake className="w-3.5 h-3.5" />
                                                    Detalhes da Renegociação
                                                </div>
                                                <p className="mb-1">Data: {format(parseISO(item.negotiation_date), "dd/MM/yyyy")}</p>
                                                {item.negotiation_notes && <p className="opacity-80 italic">"{item.negotiation_notes}"</p>}
                                            </div>
                                        )}

                                        {/* Payment Methods (Active only) */}
                                        {activeTab === 'open' && item.metadata && (
                                            <div className="space-y-2 pt-2 border-t border-gray-100">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Opções de Pagamento</p>

                                                {item.metadata.boleto_code && (
                                                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                                                <Barcode className="w-3.5 h-3.5" /> Código de Barras
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopy(item.metadata!.boleto_code!, item.id + '-bar');
                                                                }}
                                                                className="text-brand-600 text-xs font-medium"
                                                            >
                                                                {copiedId === item.id + '-bar' ? 'Copiado' : 'Copiar'}
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] font-mono text-gray-500 break-all leading-tight">
                                                            {item.metadata.boleto_code}
                                                        </p>
                                                    </div>
                                                )}

                                                {item.metadata.boleto_url && (
                                                    <a
                                                        href={item.metadata.boleto_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        Baixar Fatura PDF
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Expand Toggle Text */}
                            <button
                                onClick={() => toggleExpand(item.id)}
                                className="w-full py-1.5 flex items-center justify-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-50 hover:bg-gray-100 transition-colors border-t border-gray-100"
                            >
                                {expandedId === item.id ? (
                                    <>Minimizar <ChevronUp className="w-3 h-3" /></>
                                ) : (
                                    <>Ver detalhes <ChevronDown className="w-3 h-3" /></>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
