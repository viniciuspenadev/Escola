import { type FC, useState, useEffect } from 'react';
import { Card, Button } from '../components/ui';
import {
    DollarSign,
    TrendingUp,
    AlertCircle,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    CreditCard
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

export const FinancialDashboardView: FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [upcoming, setUpcoming] = useState<any[]>([]);
    const [stats, setStats] = useState({
        expectedRevenue: 0,
        collectedRevenue: 0,
        overdueAmount: 0,
        pendingCount: 0,
        totalDiscounts: 0,
        totalSurcharges: 0
    });

    useEffect(() => {
        const fetchFinancialStats = async () => {
            try {
                // Fetch stats (existing logic) + Upcoming Installments
                const { data: installments, error } = await supabase
                    .from('installments')
                    .select('*, enrollment:enrollments(student:students(name))')
                    .order('due_date', { ascending: true }); // Get all for stats, we will slice for upcoming locally or could split queries

                if (error) throw error;

                const today = new Date();
                const nextWeek = new Date();
                nextWeek.setDate(today.getDate() + 7);

                // Calculate Stats
                const stats = (installments || []).reduce((acc: any, curr: any) => {
                    const val = Number(curr.value || 0);
                    const discount = Number(curr.discount_value || 0);
                    const surcharge = Number(curr.surcharge_value || 0);
                    const dueDate = new Date(curr.due_date);
                    const isOverdue = dueDate < today && curr.status === 'pending';

                    // Total Expected
                    acc.expectedRevenue += val;

                    // Collected
                    if (curr.status === 'paid') {
                        acc.collectedRevenue += val;
                    }

                    // Overdue
                    if (isOverdue) {
                        acc.overdueAmount += val;
                        acc.pendingCount++;
                    }

                    // Negotiations
                    acc.totalDiscounts += discount;
                    acc.totalSurcharges += surcharge;

                    return acc;
                }, {
                    expectedRevenue: 0,
                    collectedRevenue: 0,
                    overdueAmount: 0,
                    pendingCount: 0,
                    totalDiscounts: 0,
                    totalSurcharges: 0
                });

                setStats(stats);

                // Filter Upcoming (Pending, due in future but soon)
                const upcomingList = (installments || [])
                    .filter((i: any) => i.status === 'pending' && new Date(i.due_date) >= today && new Date(i.due_date) <= nextWeek)
                    .slice(0, 5); // Take top 5

                setUpcoming(upcomingList);

            } catch (error) {
                console.error('Error fetching financial stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchFinancialStats();
    }, []);

    const handleAutomatedBilling = () => {
        // Future: Call Edge Function to send emails
        alert(`Simulação: Enviando ${stats.pendingCount} lembretes de cobrança via Email/WhatsApp...`);
    };

    const KpiCard = ({ label, value, icon: Icon, color, bg, subLabel, trend }: any) => (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-3">
                <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
                {trend && (
                    <span className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {typeof value === 'number'
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
                        : value}
                </h3>
                {subLabel && <p className="text-xs text-gray-400 mt-1 font-medium">{subLabel}</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Financeiro</h1>
                    <p className="text-gray-500">Gestão de receitas, inadimplência e fluxo de caixa.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/financeiro/planos')}>
                        <Wallet className="w-4 h-4 mr-2" />
                        Planos & Preços
                    </Button>
                    <Button className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/20" onClick={() => navigate('/financeiro/novo-lancamento')}>
                        <DollarSign className="w-4 h-4 mr-2" />
                        Novo Lançamento
                    </Button>
                </div>
            </div>

            {/* KPI Cards Row (Existing) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Receita Prevista"
                    value={loading ? '-' : stats.expectedRevenue}
                    icon={Calendar}
                    color="text-gray-600"
                    bg="bg-gray-50"
                    subLabel="Total em aberto"
                />
                <KpiCard
                    label="Recebido (YTD)"
                    value={loading ? '-' : stats.collectedRevenue}
                    icon={TrendingUp}
                    color="text-green-600"
                    bg="bg-green-50"
                    trend={12.5}
                />
                <KpiCard
                    label="Inadimplência"
                    value={loading ? '-' : stats.overdueAmount}
                    icon={AlertCircle}
                    color="text-red-600"
                    bg="bg-red-50"
                    subLabel={`${stats.pendingCount} pagamentos atrasados`}
                    trend={-2.4}
                />
                <KpiCard
                    label="Descontos Concedidos"
                    value={loading ? '-' : stats.totalDiscounts}
                    icon={ArrowDownRight}
                    color="text-orange-600"
                    bg="bg-orange-50"
                    subLabel="Custo de negociação"
                />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Transactions / Feed (Placeholder for now, future: Transactions Table) */}
                <Card className="lg:col-span-2 p-5">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg font-bold text-gray-900">Fluxo Recente</h3>
                        <Button variant="ghost" size="sm">Ver tudo</Button>
                    </div>
                    <div className="space-y-3">
                        <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <CreditCard className="w-8 h-8 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">Nenhuma movimentação recente registrada.</p>
                        </div>
                    </div>
                </Card>

                {/* Quick Actions / Alerts */}
                <div className="space-y-5">

                    {/* Automated Billing Card */}
                    <Card className="p-5 bg-gradient-to-br from-brand-600 to-brand-700 text-white border-none shadow-xl shadow-brand-900/20">
                        <h3 className="font-bold text-lg mb-2">Cobrança Automática</h3>
                        <p className="text-brand-100 text-sm mb-4">
                            Você tem {stats.pendingCount} parcelas vencidas. Envie lembretes automáticos agora.
                        </p>
                        <Button
                            className="w-full bg-white text-brand-700 hover:bg-brand-50 border-none"
                            onClick={handleAutomatedBilling}
                            disabled={stats.pendingCount === 0}
                        >
                            Disparar Cobranças
                        </Button>
                    </Card>

                    {/* Upcoming Due Dates Card */}
                    <Card className="p-5">
                        <h3 className="font-bold text-gray-900 mb-4">Próximos Vencimentos</h3>
                        <div className="space-y-3">
                            {loading ? (
                                <p className="text-sm text-gray-400">Carregando...</p>
                            ) : upcoming.length === 0 ? (
                                <p className="text-sm text-gray-400">Nenhum vencimento nos próximos 7 dias.</p>
                            ) : (
                                upcoming.map((acc: any) => (
                                    <div
                                        key={acc.id}
                                        onClick={() => navigate(`/financeiro/cobranca/${acc.id}`)}
                                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {new Date(acc.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate w-24" title={acc.enrollment?.student?.name}>
                                                    {acc.enrollment?.student?.name || 'Aluno'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.value)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
