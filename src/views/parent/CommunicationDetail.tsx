import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { CommunicationRecipient } from '../../types';
import { Loader2, ArrowLeft, Send, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Icons from 'lucide-react';

interface ReplyMessage {
    id: string;
    content: string;
    created_at: string;
    guardian_id: string;
    is_admin_reply?: boolean;
}

const CommunicationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [recipient, setRecipient] = useState<CommunicationRecipient | null>(null);
    const [replies, setReplies] = useState<ReplyMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [replyText, setReplyText] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id && user) {
            fetchDetail();
        }
    }, [id, user]);

    // Scroll to bottom when replies update
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [replies]);

    const fetchDetail = async () => {
        try {
            setLoading(true);
            // 1. Fetch the Main Communication Recipient entry
            // We use .maybeSingle() NOT .single() because duplicate rows might exist (e.g. multiple kids)
            // Actually, we fetch a list and take the first one to avoid 406 error.
            const { data: recipientData, error: recipientError } = await supabase
                .from('communication_recipients')
                .select(`
                    *,
                    communication:communications (
                        *,
                        channel:communication_channels (*),
                        sender_profile:profiles (name)
                    )
                `)
                .eq('communication_id', id)
                .eq('guardian_id', user?.id)
                .limit(1);

            if (recipientError) throw recipientError;

            // Handle array result
            const item = recipientData && recipientData.length > 0 ? recipientData[0] : null;
            setRecipient(item as CommunicationRecipient);

            // 2. Fetch Replies (Thread)
            if (item) {
                const { data: repliesData, error: repliesError } = await supabase
                    .from('communication_replies')
                    .select('*')
                    .eq('communication_id', id)
                    .order('created_at', { ascending: true });

                if (repliesError) console.error("Error fetching replies:", repliesError);
                else setReplies(repliesData || []);

                // 3. Mark as read logic (Update ALL occurrences for this guardian)
                if (!item.read_at) {
                    await supabase.from('communication_recipients')
                        .update({ read_at: new Date().toISOString() })
                        .eq('communication_id', item.communication_id)
                        .eq('guardian_id', user?.id);
                }
            }

        } catch (err) {
            console.error('Error loading communication:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleWidgetResponse = async (option: string) => {
        if (!recipient) return;
        setSubmitting(true);
        try {
            const responsePayload = {
                selected_option: option,
                answered_at: new Date().toISOString()
            };

            // Update ALL recipient rows for this guardian (in case of duplicates)
            await supabase
                .from('communication_recipients')
                .update({ response: responsePayload })
                .eq('communication_id', recipient.communication_id)
                .eq('guardian_id', user?.id);

            setRecipient(prev => prev ? { ...prev, response: responsePayload } : null);
        } catch (error) {
            console.error('Error saving response:', error);
            alert('Erro ao salvar resposta.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !user || !id) return;
        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('communication_replies')
                .insert({
                    communication_id: id,
                    guardian_id: user.id,
                    content: replyText
                })
                .select()
                .single();

            if (error) throw error;

            // Update UI
            setReplies(prev => [...prev, data]);
            setReplyText('');

        } catch (error) {
            console.error('Error sending reply:', error);
            alert('Erro ao enviar mensagem.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" />
            </div>
        );
    }

    if (!recipient || !recipient.communication || !recipient.communication.channel) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <p className="text-gray-500 mb-4">Comunicado não encontrado.</p>
                <button onClick={() => navigate(-1)} className="text-blue-600 font-medium">Voltar</button>
            </div>
        );
    }

    const { communication } = recipient;
    const { channel } = communication;
    // @ts-ignore
    const IconComponent = Icons[channel.icon_name.charAt(0).toUpperCase() + channel.icon_name.slice(1)] || Icons.MessageSquare;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col animate-fade-in">
            {/* Header Sticky */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-3 shadow-sm flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold text-gray-800 truncate">{communication.title}</h1>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                        {channel?.name} • {replies.length} mensagens
                    </span>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 pb-32">
                <div className="max-w-2xl mx-auto space-y-6">

                    {/* MAIN EMAIL CARD */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Email Header */}
                        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full bg-${channel?.color || 'blue'}-50 flex items-center justify-center text-${channel?.color || 'blue'}-600 border border-${channel?.color || 'blue'}-100`}>
                                    {/* @ts-ignore */}
                                    {React.createElement(Icons[channel?.icon_name.charAt(0).toUpperCase() + channel?.icon_name.slice(1)] || Icons.User, { size: 24 })}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-gray-900 text-sm">
                                            {communication.sender_profile?.name || 'Escola'}
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-${channel?.color}-50 text-${channel?.color}-700 border-${channel?.color}-200`}>
                                            {channel?.name}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Para: Você
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 whitespace-nowrap pt-1">
                                {format(new Date(communication.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                            </div>
                        </div>

                        {/* Email Body */}
                        <div className="p-6">
                            <div
                                className="prose prose-blue prose-sm max-w-none text-gray-700 font-sans"
                                dangerouslySetInnerHTML={{ __html: communication.content }}
                            />
                        </div>

                        {/* Widgets (RSVP/Poll) - Embedded in the email body effectively */}
                        {communication.metadata?.template === 'rsvp' && (
                            <div className="px-6 pb-6">
                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                    <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                        <Icons.CalendarCheck size={16} /> Confirmação
                                    </h3>
                                    {recipient.response ? (
                                        <div className="text-center py-2">
                                            <span className="text-sm text-gray-600">Você respondeu: </span>
                                            <span className="font-bold text-blue-700">{recipient.response.selected_option}</span>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleWidgetResponse('Estarei Presente')} disabled={submitting} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">Sim, eu vou</button>
                                            <button onClick={() => handleWidgetResponse('Não Poderei Comparecer')} disabled={submitting} className="flex-1 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50">Não vou</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {communication.metadata?.template === 'poll' && (
                            <div className="px-6 pb-6">
                                <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                                    <h3 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2">
                                        <Icons.BarChart2 size={16} /> Enquete
                                    </h3>
                                    <p className="text-sm text-purple-800 mb-3 font-medium">{communication.metadata.question}</p>
                                    <div className="space-y-2">
                                        {communication.metadata.options?.map((opt: string) => (
                                            <button
                                                key={opt}
                                                onClick={() => handleWidgetResponse(opt)}
                                                disabled={submitting || !!recipient.response}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm border flex justify-between items-center transition-colors ${recipient.response?.selected_option === opt
                                                    ? 'bg-purple-100 border-purple-300 text-purple-800 font-bold'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-purple-50'
                                                    }`}
                                            >
                                                {opt}
                                                {recipient.response?.selected_option === opt && <Icons.Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Replies / Thread History */}
                    {replies.length > 0 && (
                        <div className="space-y-4 pt-4 relative">
                            {/* Line connecting thread */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gray-100 -z-10"></div>

                            {replies.map(reply => {
                                const isMe = !reply.is_admin_reply && reply.guardian_id === user?.id;
                                const isAdmin = reply.is_admin_reply;

                                return (
                                    <div key={reply.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`max-w-[85%] rounded-2xl p-4 shadow-sm border 
                                            ${isMe
                                                    ? 'bg-blue-600 text-white border-blue-600 rounded-tr-none'
                                                    : isAdmin
                                                        ? 'bg-gray-100 text-gray-800 border-gray-200 rounded-tl-none'
                                                        : 'bg-white text-gray-800 border-gray-200 rounded-tl-none' // Fallback
                                                }`}
                                        >
                                            {isAdmin && <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Escola</div>}
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                                            <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                                                {format(new Date(reply.created_at), "HH:mm", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div ref={bottomRef}></div>
                </div>
            </div>

            {/* REPLY INPUT AREA (Fixed Bottom) */}
            <div className="bg-white border-t border-gray-200 p-3 sm:p-4 sticky bottom-0 z-20 pb-safe">
                <div className="max-w-2xl mx-auto flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all shadow-sm">
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Paperclip size={20} />
                    </button>
                    <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Escreva uma resposta..."
                        className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[24px] py-2 text-sm text-gray-800 placeholder-gray-400"
                        rows={1}
                        style={{ height: 'auto', minHeight: '44px' }}
                        onInput={(e) => {
                            e.currentTarget.style.height = 'auto'; // Reset height
                            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; // Set to scrollHeight
                        }}
                    />
                    <button
                        onClick={handleSendReply}
                        disabled={submitting || !replyText.trim()}
                        className="p-2 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all flex items-center justify-center"
                    >
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-gray-400">Esta mensagem será vista pelos administradores.</p>
                </div>
            </div>
        </div>
    );
};

export default CommunicationDetail;
