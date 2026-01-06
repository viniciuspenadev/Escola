import { type FC, useState, useEffect } from 'react';
import { Button, Card } from '../components/ui';
import {
    Search,
    CheckCircle,
    AlertCircle,
    Download,
    Eye,
    EyeOff,
    TrendingUp,
    FileText,
    Clock
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

export const FinancialReceivablesView: FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [installments, setInstallments] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

    // Advanced Filters - Defaults to "All" for maximum visibility
    const [statusFilter, setStatusFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all'); // all years by default
    const [searchTerm, setSearchTerm] = useState('');

    const fetchInstallments = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('installments')
                .select(`
                    *,
                    enrollment:enrollments (
                        id,
                        candidate_name,
                        student_id,
                        details
                    )
                `)
                .order('due_date', { ascending: true });

            // Apply Status Filter
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            // Apply Date Filter (Month/Year)
            if (yearFilter !== 'all') {
                if (monthFilter !== 'all') {
                    const startDate = new Date(Number(yearFilter), Number(monthFilter), 1).toISOString();
                    const endDate = new Date(Number(yearFilter), Number(monthFilter) + 1, 0).toISOString();
                    query = query.gte('due_date', startDate).lte('due_date', endDate);
                } else {
                    const startYear = new Date(Number(yearFilter), 0, 1).toISOString();
                    const endYear = new Date(Number(yearFilter), 11, 31).toISOString();
                    query = query.gte('due_date', startYear).lte('due_date', endYear);
                }
            }
            // If year is 'all', we don't filter dates (show all history)

            const { data, error } = await query;

            if (error) throw error;

            // Client-side filtering for Search
            let filteredData = data || [];
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                filteredData = filteredData.filter((item: any) =>
                    item.enrollment?.candidate_name?.toLowerCase().includes(lowerTerm)
                );
            }

            setInstallments(filteredData);
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao carregar mensalidades');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(installments.map(i => i.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkAction = async (action: 'publish' | 'hide' | 'mark_paid') => {
        if (!confirm(`Tem certeza que deseja aplicar esta ação em ${selectedIds.length} itens?`)) return;

        setIsBulkActionLoading(true);
        try {
            let updates: any = {};

            if (action === 'publish') updates = { is_published: true };
            if (action === 'hide') updates = { is_published: false };
            if (action === 'mark_paid') {
                updates = {
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    payment_method: 'bulk_manual' // Marker for bulk updates
                };
            }

            const { error } = await supabase
                .from('installments')
                .update(updates)
                .in('id', selectedIds);

            if (error) throw error;

            addToast('success', 'Ação em massa concluída com sucesso!');
            setSelectedIds([]);
            fetchInstallments();
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro na ação em massa: ' + error.message);
        } finally {
            setIsBulkActionLoading(false);
        }
    };

    useEffect(() => {
        fetchInstallments();
    }, [statusFilter, monthFilter, yearFilter, searchTerm]);

    // Stats Calculation for current view
    const stats = installments.reduce((acc, curr) => {
        const val = Number(curr.value || 0);
        const isOverdue = new Date(curr.due_date) < new Date() && curr.status === 'pending';

        acc.total += val;
        if (curr.status === 'paid') acc.received += val;
        if (isOverdue) acc.overdue += val;
        if (curr.status === 'pending' && !isOverdue) acc.pending += val;

        return acc;
    }, { total: 0, received: 0, overdue: 0, pending: 0 });

    const getStatusBadge = (status: string, dueDate: string) => {
        const isOverdue = new Date(dueDate) < new Date() && status === 'pending';

        if (status === 'paid') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" /> Pago
                </span>
            );
        }
        if (isOverdue) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                    <AlertCircle className="w-3.5 h-3.5" /> Atrasado
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5" /> Pendente
            </span>
        );
    };

    // Shared KpiCard Component (Consistent Design with Dashboard)
    const KpiCard = ({ label, value, icon: Icon, color, bg, subLabel }: any) => (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-3">
                <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                </h3>
                {subLabel && <p className="text-xs text-gray-400 mt-1 font-medium">{subLabel}</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mensalidades</h1>
                    <p className="text-gray-500 mt-1">Gestão completa de cobranças e recebimentos.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="bg-white">
                        <Download className="w-4 h-4 mr-2" /> Exportar Relatório
                    </Button>
                </div>
            </div>

            {/* KPI Cards (Consistent Design) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Lançado"
                    value={stats.total}
                    icon={FileText}
                    color="text-gray-600"
                    bg="bg-gray-50"
                />
                <KpiCard
                    label="Recebido"
                    value={stats.received}
                    icon={TrendingUp}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <KpiCard
                    label="A Receber"
                    value={stats.pending}
                    icon={Clock}
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
                <KpiCard
                    label="Em Atraso"
                    value={stats.overdue}
                    icon={AlertCircle}
                    color="text-red-600"
                    bg="bg-red-50"
                />
            </div>

            {/* Main Content Card */}
            <Card className="border border-gray-200 shadow-sm overflow-hidden">
                {/* Filters Toolbar */}
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col xl:flex-row gap-4 justify-between items-end xl:items-center">

                    <div className="flex-1 w-full xl:max-w-md relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium"
                            placeholder="Buscar por aluno, matrícula..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap gap-3 w-full xl:w-auto">
                        <select
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-medium text-gray-600 cursor-pointer hover:border-brand-300"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                        >
                            <option value="all">Todo o Ano</option>
                            <option value="0">Janeiro</option>
                            <option value="1">Fevereiro</option>
                            <option value="2">Março</option>
                            <option value="3">Abril</option>
                            <option value="4">Maio</option>
                            <option value="5">Junho</option>
                            <option value="6">Julho</option>
                            <option value="7">Agosto</option>
                            <option value="8">Setembro</option>
                            <option value="9">Outubro</option>
                            <option value="10">Novembro</option>
                            <option value="11">Dezembro</option>
                        </select>

                        <select
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-medium text-gray-600 cursor-pointer hover:border-brand-300"
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                        >
                            <option value="all">Todos os Anos</option>
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                        </select>

                        <div className="h-6 w-px bg-gray-300 hidden md:block mx-1"></div>

                        <div className="flex bg-gray-200 p-1 rounded-lg">
                            {['all', 'paid', 'pending', 'overdue'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`
                                        px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize
                                        ${statusFilter === status
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }
                                    `}
                                >
                                    {status === 'all' ? 'Todos' : status === 'paid' ? 'Pagos' : status === 'pending' ? 'Pendentes' : 'Atrasados'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 w-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        checked={installments.length > 0 && selectedIds.length === installments.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Vencimento</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Aluno</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Ref.</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Valor</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Visibilidade</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Pagamento</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4 w-4"><div className="h-4 w-4 bg-gray-200 rounded" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                                        <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-24" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                                    </tr>
                                ))
                            ) : installments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                <Search className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <p className="text-lg font-medium text-gray-900">Nenhuma mensalidade encontrada</p>
                                            <p className="text-sm">Tente ajustar os filtros de data ou status.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                installments.map((inst) => (
                                    <tr
                                        key={inst.id}
                                        onClick={() => navigate(`/financeiro/cobranca/${inst.id}`)}
                                        className="hover:bg-blue-50/50 border-t border-gray-100 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                                checked={selectedIds.includes(inst.id)}
                                                onChange={() => toggleSelection(inst.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {new Date(inst.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                </span>
                                                <span className="text-xs text-gray-400 font-medium">
                                                    {new Date(inst.due_date).getFullYear()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs uppercase">
                                                    {inst.enrollment?.candidate_name?.substring(0, 2) || 'AL'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900">{inst.enrollment?.candidate_name}</span>
                                                    <span className="text-xs text-gray-400">Matrícula #{inst.enrollment_id?.slice(0, 6)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                                            {inst.installment_number}ª Parcela
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 font-mono">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.value)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {inst.is_published ? (
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-md w-fit border border-blue-100">
                                                    <Eye className="w-3.5 h-3.5" /> Publicado
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md w-fit border border-gray-200" title="Não visível para o responsável">
                                                    <EyeOff className="w-3.5 h-3.5" /> Rascunho
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(inst.status, inst.due_date)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {inst.paid_at ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-emerald-700">
                                                        {new Date(inst.paid_at).toLocaleDateString('pt-BR')}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 uppercase">
                                                        Via {inst.payment_method || 'Manual'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 flex items-center gap-6 z-50 animate-slide-up">
                    <div className="flex items-center gap-2 border-r border-gray-200 pr-6">
                        <span className="bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded text-sm">
                            {selectedIds.length}
                        </span>
                        <span className="text-sm font-medium text-gray-600">selecionados</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkAction('publish')}
                            disabled={isBulkActionLoading}
                        >
                            <Eye className="w-4 h-4 mr-2" /> Publicar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkAction('hide')}
                            disabled={isBulkActionLoading}
                        >
                            <EyeOff className="w-4 h-4 mr-2" /> Ocultar
                        </Button>
                        <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                            onClick={() => handleBulkAction('mark_paid')}
                            disabled={isBulkActionLoading}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pago
                        </Button>
                    </div>

                    <button
                        onClick={() => setSelectedIds([])}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
};
