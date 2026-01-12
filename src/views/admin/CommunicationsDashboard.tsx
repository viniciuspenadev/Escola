import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Icons from 'lucide-react';
import { Loader2, Plus, BarChart2, CheckCircle2, XCircle, Send, MessageSquare, FileText, Users, Search, AlertCircle, Sparkles, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface CommunicationStats {
    id: string;
    title: string;
    created_at: string;
    content: string;
    channel: { name: string; color: string; icon_name: string };
    total_recipients: number;
    read_count: number;
    responses?: {
        response: any;
        guardian: { name: string; avatar_url?: string };
        answered_at?: string;
    }[];
    metadata?: any;
    reply_count?: number;
    priority?: number;
    sender_profile?: { name: string };
    pending_count?: number;
}

interface Conversation {
    guardian_id: string;
    guardian_name: string;
    avatar_url?: string;
    last_message_at: string;
    messages: {
        id: string;
        content: string;
        created_at: string;
        is_admin_reply: boolean;
        sender_name?: string;
    }[];
    needs_reply?: boolean;
    unread_count?: number;
}

const CommunicationsDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState<CommunicationStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedComm, setSelectedComm] = useState<CommunicationStats | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'messages'>('overview');

    // Conversation State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [responseMessage, setResponseMessage] = useState(''); // Renamed from replyText
    const [sendingReply, setSendingReply] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false); // New state for emoji picker

    // RSVP Modal State
    const [isRSVPModalOpen, setIsRSVPModalOpen] = useState(false);
    const [rsvpSort, setRsvpSort] = useState<'name' | 'status' | 'date'>('date'); // Type order changed
    const [rsvpSortDir, setRsvpSortDir] = useState<'asc' | 'desc'>('desc');

    const handleExportCSV = () => {
        if (!selectedComm?.responses) return;

        const headers = ['Responsável', 'Resposta', 'Data'];
        const rows = selectedComm.responses.map(r => [
            r.guardian.name,
            r.response.selected_option,
            format(new Date(r.answered_at || ''), "dd/MM/yyyy HH:mm", { locale: ptBR })
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `rsvp_lista_${selectedComm.title.replace(/\s+/g, '_').toLowerCase()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getSortedRSVP = () => {
        if (!selectedComm?.responses) return [];

        return [...selectedComm.responses].sort((a, b) => {
            let valA, valB;

            switch (rsvpSort) {
                case 'name':
                    valA = a.guardian.name.toLowerCase();
                    valB = b.guardian.name.toLowerCase();
                    break;
                case 'status':
                    valA = a.response.selected_option === 'Estarei Presente' ? 1 : 0;
                    valB = b.response.selected_option === 'Estarei Presente' ? 1 : 0;
                    break;
                case 'date':
                default:
                    valA = new Date(a.answered_at || '').getTime();
                    valB = new Date(b.answered_at || '').getTime();
                    break;
            }

            if (valA < valB) return rsvpSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return rsvpSortDir === 'asc' ? 1 : -1;
            return 0;
        });
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (selectedComm) {
            fetchConversations(selectedComm.id);
            setActiveTab('overview'); // Reset tab on change
        } else {
            setConversations([]);
            setSelectedConversationId(null);
        }
    }, [selectedComm]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const { data: comms, error } = await supabase
                .from('communications')
                .select(`
                    id, title, created_at, metadata, content, priority,
                    channel: communication_channels(name, color, icon_name),
                    sender_profile:profiles!sender_profile_id(name)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const enriched = await Promise.all(comms.map(async (c: any) => {
                // Get totals
                const { count: total } = await supabase
                    .from('communication_recipients')
                    .select('*', { count: 'exact', head: true })
                    .eq('communication_id', c.id);

                const { count: read } = await supabase
                    .from('communication_recipients')
                    .select('*', { count: 'exact', head: true })
                    .eq('communication_id', c.id)
                    .not('read_at', 'is', null);

                // Fetch Detailed Responses if interactive (RSVP/Poll)
                let responses: any[] = [];
                if (c.metadata?.template) {
                    const { data: respData } = await supabase
                        .from('communication_recipients')
                        .select(`
                            response,
                            guardian: profiles!guardian_id(name)
                        `)
                        .eq('communication_id', c.id)
                        .not('response', 'is', null);

                    responses = respData || [];
                }

                // Fetch All Replies (Admin & Guardian) with valid Profiles
                // We use this single source for both 'reply_count' (total from guardians) and 'pending_count'
                const { data: allReplies } = await supabase
                    .from('communication_replies')
                    .select('guardian_id, created_at, is_admin_reply, guardian:profiles!inner(id)') // !inner join filters orphans
                    .eq('communication_id', c.id)
                    .order('created_at', { ascending: true });

                // Calculate stats from valid replies
                // Calculate stats from valid replies
                const validReplies = allReplies || [];

                // Fix: Count Unique Guardians (Conversations) instead of total messages
                const uniqueGuardians = new Set(validReplies.filter(r => !r.is_admin_reply).map(r => r.guardian_id));
                const replyCount = uniqueGuardians.size;

                let pendingMessageCount = 0;
                if (validReplies.length > 0) {
                    const threads: { [key: string]: any[] } = {};
                    validReplies.forEach(r => {
                        if (!threads[r.guardian_id]) threads[r.guardian_id] = [];
                        threads[r.guardian_id].push(r);
                    });

                    // Count threads with unread messages
                    Object.values(threads).forEach((threadMsgs: any[]) => {
                        // Find index of last admin reply
                        let lastAdminIndex = -1;
                        for (let i = threadMsgs.length - 1; i >= 0; i--) {
                            if (threadMsgs[i].is_admin_reply) {
                                lastAdminIndex = i;
                                break;
                            }
                        }
                        // Check if there are messages after the last admin reply
                        const hasUnread = (threadMsgs.length - 1 - lastAdminIndex) > 0;
                        if (hasUnread) pendingMessageCount += 1; // Count conversation, not messages
                    });
                }

                return {
                    ...c,
                    total_recipients: total || 0,
                    read_count: read || 0,
                    reply_count: replyCount,
                    pending_count: pendingMessageCount,
                    responses
                };
            }));

            setStats(enriched);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchConversations = async (commId: string) => {
        setLoadingConversations(true);
        try {
            const { data, error } = await supabase
                .from('communication_replies')
                .select(`
                    id, content, created_at, guardian_id, is_admin_reply,
                    guardian: profiles!guardian_id!inner(name)
                `)
                .eq('communication_id', commId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Group by Guardian
            const grouped: Record<string, Conversation> = {};

            data?.forEach((msg: any) => {
                if (!grouped[msg.guardian_id]) {
                    grouped[msg.guardian_id] = {
                        guardian_id: msg.guardian_id,
                        guardian_name: msg.guardian?.name || 'Responsável',
                        avatar_url: undefined, // No avatar_url in profiles table
                        last_message_at: msg.created_at,
                        messages: []
                    };
                }
                grouped[msg.guardian_id].messages.push({
                    id: msg.id,
                    content: msg.content,
                    created_at: msg.created_at,
                    is_admin_reply: msg.is_admin_reply,
                    sender_name: msg.is_admin_reply ? 'Escola' : (msg.guardian?.name || 'Responsável')
                });
                // Update last message time
                if (new Date(msg.created_at) > new Date(grouped[msg.guardian_id].last_message_at)) {
                    grouped[msg.guardian_id].last_message_at = msg.created_at;
                }
            });

            // Sort conversations by last message
            const sorted = Object.values(grouped).sort((a, b) =>
                new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            );

            // Add needs_reply status and unread count
            const conversationsWithReplyStatus = sorted.map(conv => {
                const lastMessage = conv.messages[conv.messages.length - 1];
                // Calculate unread count (messages since last admin reply)
                let lastAdminIndex = -1;
                for (let i = conv.messages.length - 1; i >= 0; i--) {
                    if (conv.messages[i].is_admin_reply) {
                        lastAdminIndex = i;
                        break;
                    }
                }
                const unreadCount = conv.messages.length - 1 - lastAdminIndex;

                const needsReply = lastMessage ? !lastMessage.is_admin_reply : false;
                return { ...conv, needs_reply: needsReply, unread_count: unreadCount };
            });

            setConversations(conversationsWithReplyStatus);

            // Select first if none selected
            if (conversationsWithReplyStatus.length > 0 && !selectedConversationId) {
                // Prefer selecting one that needs reply first
                const needsReplyConv = conversationsWithReplyStatus.find(c => c.needs_reply);
                setSelectedConversationId(needsReplyConv ? needsReplyConv.guardian_id : conversationsWithReplyStatus[0].guardian_id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingConversations(false);
        }
    };

    const handleSendReply = async () => {
        if (!selectedComm || !selectedConversationId || !responseMessage.trim() || !user) return; // Changed replyText to responseMessage
        setSendingReply(true);
        try {
            const { error } = await supabase.from('communication_replies').insert({
                communication_id: selectedComm.id,
                guardian_id: selectedConversationId,
                content: responseMessage, // Changed replyText to responseMessage
                is_admin_reply: true
            });
            if (error) throw error;
            setResponseMessage(''); // Changed setReplyText to setResponseMessage
            setIsEmojiPickerOpen(false); // Close emoji picker after sending
            await fetchConversations(selectedComm.id);
        } catch (err) {
            console.error(err);
            alert('Erro ao enviar resposta.');
        } finally {
            setSendingReply(false);
        }
    };

    const calculatePercentage = (part: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((part / total) * 100);
    };




    const activeConversation = conversations.find(c => c.guardian_id === selectedConversationId);

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden font-sans">
            {/* LEFT SIDEBAR: LIST */}
            <div className="w-80 flex flex-col border-r border-gray-200 bg-slate-50 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
                {/* Header */}
                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                    <h2 className="font-outfit font-bold text-xl text-gray-900 tracking-tight">Comunicados</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/admin/comunicados/novo')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-blue-200 shadow-md"
                            title="Novo Comunicado"
                        >
                            <Plus size={18} />
                            Novo Comunicado
                        </button>
                    </div>
                </div>

                {/* Search/Filter Bar */}
                <div className="px-5 py-4 flex gap-3 bg-slate-50">
                    <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center px-3.5 py-2.5 transition-all focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50 shadow-sm">
                        <Search size={16} className="text-gray-400" />
                        <input className="bg-transparent border-none text-sm w-full focus:ring-0 ml-2.5 placeholder-gray-400 text-gray-700 outline-none" placeholder="Buscar..." />
                    </div>
                </div>

                {/* List Items */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin pt-0">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
                    ) : (
                        <div className="space-y-3">
                            {stats.map(item => {
                                // @ts-ignore
                                const Icon = Icons[item.channel.icon_name.charAt(0).toUpperCase() + item.channel.icon_name.slice(1)] || Icons.MessageSquare;
                                const isSelected = selectedComm?.id === item.id;
                                const readRate = calculatePercentage(item.read_count, item.total_recipients);
                                const isUrgent = item.priority === 2;
                                const isInteractive = item.metadata?.template;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedComm(item)}
                                        className={`group p-4 rounded-xl cursor-pointer transition-all border relative overflow-hidden flex flex-col gap-2 ${isSelected
                                            ? 'bg-white border-blue-500 shadow-md ring-4 ring-blue-50/50 z-10'
                                            : 'bg-white border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            {/* Top Row: Channel Badge & Date */}
                                            <div className="flex items-center gap-2">
                                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 bg-${item.channel.color}-50 text-${item.channel.color}-700 border border-${item.channel.color}-100`}>
                                                    <Icon size={10} strokeWidth={3} />
                                                    {item.channel.name}
                                                </div>
                                                {isUrgent && (
                                                    <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 animate-pulse" title="Urgente">
                                                        <AlertCircle size={10} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-0.5 text-[10px] font-medium text-gray-400">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="text-gray-600 font-bold truncate max-w-[100px]" title={item.sender_profile?.name || 'Escola'}>
                                                        {item.sender_profile?.name?.split(' ')[0] || 'Escola'}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{format(new Date(item.created_at), "dd MMM", { locale: ptBR })}</span>
                                                </div>
                                                <span className="text-gray-400">
                                                    Para: {item.total_recipients > 0 ? `${item.total_recipients} destinatários` : 'Todos'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Title Row */}
                                        <h3 className={`text-sm font-bold leading-snug line-clamp-2 ${isSelected ? 'text-gray-900' : 'text-gray-700 group-hover:text-blue-700 transition-colors'}`}>
                                            {item.title}
                                        </h3>

                                        {/* Bottom Row: Progress & Reply Count */}
                                        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-50 mt-1">
                                            <div className="flex items-center gap-2" title={`Leituras: ${readRate}%`}>
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div style={{ width: `${readRate}%` }} className={`h-full rounded-full ${readRate > 50 ? 'bg-green-500' : 'bg-blue-500'}`} />
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-500">{readRate}% lido</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {isInteractive && (
                                                    <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-bold border border-purple-100">
                                                        <Sparkles size={10} />
                                                        {item.metadata.template === 'rsvp' ? 'RSVP' : 'Enquete'}
                                                    </div>
                                                )}
                                                {(item.pending_count || 0) > 0 ? (
                                                    <div className="flex items-center gap-1.5 text-white bg-red-500 px-2 py-0.5 rounded-full text-[10px] shadow-sm animate-pulse font-bold" title={`${item.pending_count} respostas aguardando atenção`}>
                                                        <MessageSquare size={10} strokeWidth={3} />
                                                        {item.pending_count} chamando
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                                        <MessageSquare size={12} />
                                                        <span className="font-bold">{item.reply_count}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            < div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden" >
                {
                    selectedComm ? (
                        <>
                            {/* Detail Header */}
                            < div className="bg-white px-8 py-6 flex justify-between items-start shrink-0 border-b border-gray-200 z-10 shadow-sm" >
                                <div className="max-w-2xl">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${selectedComm.channel.name === 'Urgente' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                            {/* @ts-ignore */}
                                            {React.createElement((Icons as any)[selectedComm.channel.icon_name.charAt(0).toUpperCase() + selectedComm.channel.icon_name.slice(1)] || Icons.MessageSquare, { size: 12 })}
                                            {selectedComm.channel.name}
                                        </span>
                                        <span className="text-gray-400 text-sm">•</span>
                                        <span className="text-gray-500 text-sm">{format(new Date(selectedComm.created_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-slate-900 leading-tight tracking-tight">{selectedComm.title}</h1>
                                </div>

                                {/* Tabs Switcher */}
                                <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1">
                                    <button
                                        onClick={() => setActiveTab('overview')}
                                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Painel Geral
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('messages')}
                                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'messages' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Conversas
                                        {conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0) > 0 ? (
                                            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm animate-pulse min-w-[20px] text-center">
                                                {conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)}
                                            </span>
                                        ) : selectedComm.reply_count ? (
                                            <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full min-w-[20px] text-center">{selectedComm.reply_count}</span>
                                        ) : null}
                                    </button>
                                </div >
                            </div >

                            {/* TAB CONTENT */}
                            < div className="flex-1 overflow-auto bg-slate-50/50" >

                                {/* OVERVIEW TAB */}
                                {
                                    activeTab === 'overview' && (
                                        <div className="p-8 max-w-[1600px] mx-auto animate-fade-in space-y-8">

                                            {/* Top Key Metrics */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                                    <span className="text-slate-500 text-sm font-medium mb-1">Total de Destinatários</span>
                                                    <span className="text-3xl font-extrabold text-slate-900">{selectedComm.total_recipients}</span>
                                                </div>
                                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                                    <span className="text-slate-500 text-sm font-medium mb-1">Leituras Confirmadas</span>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-3xl font-extrabold text-blue-600">{selectedComm.read_count}</span>
                                                        <span className="text-sm font-bold text-slate-400">({calculatePercentage(selectedComm.read_count, selectedComm.total_recipients)}%)</span>
                                                    </div>
                                                </div>
                                                {selectedComm.metadata?.template === 'rsvp' && (
                                                    <>
                                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
                                                            <div className="absolute right-0 top-0 p-4 opacity-10"><CheckCircle2 size={48} className="text-green-500" /></div>
                                                            <span className="text-slate-500 text-sm font-medium mb-1">Confirmados</span>
                                                            <span className="text-3xl font-extrabold text-green-600">
                                                                {selectedComm.responses?.filter(r => r.response.selected_option === 'Estarei Presente').length || 0}
                                                            </span>
                                                        </div>
                                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
                                                            <div className="absolute right-0 top-0 p-4 opacity-10"><XCircle size={48} className="text-red-500" /></div>
                                                            <span className="text-slate-500 text-sm font-medium mb-1">Não Comparecerão</span>
                                                            <span className="text-3xl font-extrabold text-red-600">
                                                                {selectedComm.responses?.filter(r => r.response.selected_option === 'Não Poderei Comparecer').length || 0}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 text-left">

                                                {/* Content Preview (Left 2 cols) */}
                                                <div className="xl:col-span-2 space-y-6">
                                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                                                        {/* Header Info */}
                                                        <div className="bg-gray-50/80 px-8 py-6 border-b border-gray-100 flex items-start justify-between gap-4 backdrop-blur-sm">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-sm bg-${selectedComm.channel.color}-100 text-${selectedComm.channel.color}-600`}>
                                                                    {/* @ts-ignore */}
                                                                    {React.createElement((Icons as any)[selectedComm.channel.icon_name.charAt(0).toUpperCase() + selectedComm.channel.icon_name.slice(1)] || Icons.MessageSquare, { size: 24 })}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <span className="font-bold text-gray-900 text-base">Escola</span>
                                                                        <span className="text-gray-400 text-xs">•</span>
                                                                        <span className="text-sm text-gray-500 font-medium">para Todos</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-${selectedComm.channel.color}-50 text-${selectedComm.channel.color}-700 border-${selectedComm.channel.color}-200`}>
                                                                            {selectedComm.channel.name}
                                                                        </div>
                                                                        <span className="text-xs text-gray-400">
                                                                            {format(new Date(selectedComm.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Document Content */}
                                                        <div className="p-10 flex-1">
                                                            <div
                                                                className="prose prose-lg prose-slate max-w-none font-sans text-gray-700 leading-loose"
                                                                dangerouslySetInnerHTML={{ __html: selectedComm.content }}
                                                            />

                                                            {/* Embedded Interaction Preview (ReadOnly) */}
                                                            {selectedComm.metadata?.template === 'rsvp' && (
                                                                <div className="mt-8 pt-8 border-t border-gray-100 max-w-md">
                                                                    <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                                                                        <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                                                            <Icons.CalendarCheck size={18} /> Confirmação de Presença
                                                                        </h3>
                                                                        <div className="flex gap-3 text-sm font-bold text-gray-400 text-center p-4 bg-white/50 rounded-lg border border-blue-100/50 border-dashed">
                                                                            (Widget Interativo de RSVP visível para os pais)
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Stats Sidebar (Right 1 col) */}
                                                <div className="space-y-6">
                                                    {selectedComm.metadata?.template === 'rsvp' && (
                                                        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
                                                            <div className="flex justify-between items-center mb-6">
                                                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                                                    <Users size={20} className="text-purple-500" />
                                                                    Lista de Presença
                                                                </h3>
                                                                <button
                                                                    onClick={() => setIsRSVPModalOpen(true)}
                                                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-blue-100"
                                                                >
                                                                    Gerenciar Lista Completa
                                                                </button>
                                                            </div>

                                                            {/* Mini Preview List (Top 5) */}
                                                            <div className="flex-1 space-y-4">
                                                                <div className="space-y-2">
                                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Últimas Respostas</div>
                                                                    {selectedComm.responses?.slice(0, 8).map((r, idx) => (
                                                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                                                                            ${r.response.selected_option === 'Estarei Presente' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                                    {r.guardian.name.charAt(0)}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-sm font-bold text-slate-700">{r.guardian.name}</p>
                                                                                    <p className="text-[10px] text-slate-400">{format(new Date(r.answered_at || new Date()), "dd/MM HH:mm")}</p>
                                                                                </div>
                                                                            </div>
                                                                            {r.response.selected_option === 'Estarei Presente' ? (
                                                                                <CheckCircle2 size={16} className="text-green-500" />
                                                                            ) : (
                                                                                <XCircle size={16} className="text-red-500" />
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    {(selectedComm.responses?.length || 0) > 8 && (
                                                                        <div className="text-center pt-2">
                                                                            <span className="text-xs text-slate-400 italic">...e mais {(selectedComm.responses?.length || 0) - 8} pessoas</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </section>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }

                                {/* MESSAGES TAB - UNCHANGED LOGIC, JUST WRAPPER DIV */}
                                {
                                    activeTab === 'messages' && (
                                        <div className="flex h-full">
                                            {/* (Existing components for message list/chat) */}
                                            <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
                                                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conversas Recentes</h3>
                                                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">{conversations.length}</span>
                                                </div>
                                                <div className="flex-1 overflow-y-auto">
                                                    {loadingConversations ? (
                                                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                                                    ) : conversations.length === 0 ? (
                                                        <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                                                <MessageSquare size={24} className="opacity-40" />
                                                            </div>
                                                            <p className="text-sm font-medium">Nenhuma conversa iniciada.</p>
                                                        </div>
                                                    ) : (
                                                        conversations.map(conv => (
                                                            <div
                                                                key={conv.guardian_id}
                                                                onClick={() => setSelectedConversationId(conv.guardian_id)}
                                                                className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-slate-50 transition-all relative group ${selectedConversationId === conv.guardian_id ? 'bg-blue-50/60 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                                                            >
                                                                {(conv.unread_count || 0) > 0 && (
                                                                    <div className="absolute right-3 top-3 flex items-center justify-center w-5 h-5 rounded-full bg-red-500 ring-2 ring-white shadow-sm font-bold text-[10px] text-white">
                                                                        {conv.unread_count}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shrink-0 border-2 border-white shadow-sm relative">
                                                                        {conv.avatar_url ? (
                                                                            <img src={conv.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100 font-bold text-lg">
                                                                                {conv.guardian_name.charAt(0)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                                            <span className={`text-sm truncate ${conv.needs_reply ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{conv.guardian_name}</span>
                                                                            <span className="text-[10px] text-slate-400 font-medium">{format(new Date(conv.last_message_at), "HH:mm")}</span>
                                                                        </div>
                                                                        <p className={`text-xs truncate line-clamp-1 ${conv.needs_reply ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                                                                            {conv.messages[conv.messages.length - 1].is_admin_reply && <span className="font-bold text-blue-600 mr-1">Você:</span>}
                                                                            {conv.messages[conv.messages.length - 1].content}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>


                                            {/* Chat Area */}
                                            <div className="flex-1 flex flex-col bg-slate-50/50 relative">
                                                {selectedConversationId && activeConversation ? (
                                                    <>
                                                        {/* Chat Header */}
                                                        <div className="bg-white px-6 py-4 border-b border-slate-200 shadow-sm flex justify-between items-center z-10">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-slate-100">
                                                                    {activeConversation.avatar_url ? (
                                                                        <img src={activeConversation.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-100 font-bold">
                                                                            {activeConversation.guardian_name.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-bold text-slate-900 text-lg leading-none mb-1">{activeConversation.guardian_name}</h3>
                                                                    <div className="text-xs text-green-600 flex items-center gap-1.5 font-bold uppercase tracking-wide">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-200" />
                                                                        Online no Comunicado
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Messages */}
                                                        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
                                                            {activeConversation.messages.map(msg => (
                                                                <div key={msg.id} className={`flex ${msg.is_admin_reply ? 'justify-end' : 'justify-start'}`}>
                                                                    <div className={`max-w-[65%] group relative ${msg.is_admin_reply ? 'items-end flex flex-col' : 'items-start flex flex-col'}`}>
                                                                        {!msg.is_admin_reply && (
                                                                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1 tracking-wider">{msg.sender_name}</span>
                                                                        )}
                                                                        <div className={`px-6 py-4 rounded-3xl text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${msg.is_admin_reply
                                                                            ? 'bg-blue-600 text-white rounded-br-sm shadow-blue-200'
                                                                            : 'bg-white text-slate-700 border border-slate-200 rounded-bl-sm shadow-sm'
                                                                            }`}>
                                                                            {msg.content}
                                                                        </div>
                                                                        <span className="text-[10px] text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-1 font-medium">
                                                                            {format(new Date(msg.created_at), "dd MMM HH:mm", { locale: ptBR })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Input Area */}
                                                        <div className="p-4 bg-white border-t border-slate-200">
                                                            <div className="flex items-end gap-2 relative">
                                                                <div className="relative">
                                                                    <button
                                                                        className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                                                        onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                                                    >
                                                                        <Smile size={20} />
                                                                    </button>
                                                                    {isEmojiPickerOpen && (
                                                                        <div className="absolute bottom-full left-0 mb-2 z-50">
                                                                            <EmojiPicker
                                                                                onEmojiClick={(emojiData) => {
                                                                                    setResponseMessage(prev => prev + emojiData.emoji);
                                                                                    setIsEmojiPickerOpen(false);
                                                                                }}
                                                                                width={300}
                                                                                height={400}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <textarea
                                                                    value={responseMessage}
                                                                    onChange={e => setResponseMessage(e.target.value)}
                                                                    placeholder="Escreva sua resposta..."
                                                                    className="flex-1 bg-slate-50 border-0 rounded-2xl p-3 text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none resize-none min-h-[48px] max-h-32"
                                                                    rows={1}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            handleSendReply();
                                                                        }
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={handleSendReply}
                                                                    disabled={!responseMessage.trim() || sendingReply} // Added sendingReply to disabled
                                                                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200"
                                                                >
                                                                    {sendingReply ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                                                </button>
                                                            </div>
                                                            <div className="text-center mt-2">
                                                                <span className="text-[10px] text-slate-400">Pressione Enter para enviar</span>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                                            <MessageSquare size={40} className="text-slate-300" />
                                                        </div>
                                                        <p className="text-sm font-medium">Selecione uma conversa para iniciar o atendimento.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                }

                            </div >

                            {/* RSVP DataGrid MODAL */}
                            {
                                isRSVPModalOpen && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
                                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden m-4">
                                            {/* Header */}
                                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                                <div>
                                                    <h2 className="text-xl font-bold text-gray-900">Lista de Presença Completa</h2>
                                                    <p className="text-sm text-gray-500 mt-1">Gerencie e exporte as respostas recebidas.</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={handleExportCSV}
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-bold text-sm transition-colors border border-green-100"
                                                    >
                                                        <FileText size={16} />
                                                        Exportar CSV
                                                    </button>
                                                    <button
                                                        onClick={() => setIsRSVPModalOpen(false)}
                                                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                                                    >
                                                        <XCircle size={24} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Table Content */}
                                            <div className="flex-1 overflow-auto p-0">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50 border-b border-gray-200">
                                                            <th
                                                                className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50"
                                                                onClick={() => { setRsvpSort('name'); setRsvpSortDir(rsvpSortDir === 'asc' ? 'desc' : 'asc'); }}
                                                            >
                                                                Responsável {rsvpSort === 'name' && (rsvpSortDir === 'asc' ? '↑' : '↓')}
                                                            </th>
                                                            <th
                                                                className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50"
                                                                onClick={() => { setRsvpSort('status'); setRsvpSortDir(rsvpSortDir === 'asc' ? 'desc' : 'asc'); }}
                                                            >
                                                                Status {rsvpSort === 'status' && (rsvpSortDir === 'asc' ? '↑' : '↓')}
                                                            </th>
                                                            <th
                                                                className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50"
                                                                onClick={() => { setRsvpSort('date'); setRsvpSortDir(rsvpSortDir === 'asc' ? 'desc' : 'asc'); }}
                                                            >
                                                                Data da Resposta {rsvpSort === 'date' && (rsvpSortDir === 'asc' ? '↑' : '↓')}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {getSortedRSVP().map((r, idx) => (
                                                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                                                <td className="px-8 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-blue-200 group-hover:text-blue-700 transition-colors">
                                                                            {r.guardian.name.charAt(0)}
                                                                        </div>
                                                                        <span className="font-medium text-gray-900">{r.guardian.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4">
                                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${r.response.selected_option === 'Estarei Presente'
                                                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                                                        : 'bg-red-100 text-red-700 border border-red-200'
                                                                        }`}>
                                                                        {r.response.selected_option === 'Estarei Presente' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                                        {r.response.selected_option}
                                                                    </span>
                                                                </td>
                                                                <td className="px-8 py-4 text-sm text-gray-500 font-mono">
                                                                    {format(new Date(r.answered_at || new Date()), "dd/MM/yyyy HH:mm")}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Footer */}
                                            <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
                                                <span>Mostrando {selectedComm.responses?.length || 0} respostas</span>
                                                <span>Escola V2 - Painel Administrativo</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                            <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mb-8 shadow-inner">
                                <BarChart2 size={56} className="text-slate-300" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Painel de Visualização</h2>
                            <p className="max-w-md mx-auto text-slate-500 text-lg">Selecione um comunicado para gerenciar respostas, ver estatísticas e interagir.</p>
                        </div>
                    )}
            </div >
        </div >
    );
};

export default CommunicationsDashboard;
