import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { CommunicationRecipient } from '../../types';
import CommunicationCard from '../../components/communications/CommunicationCard';
import { Loader2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


const CommunicationsInbox: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [recipients, setRecipients] = useState<CommunicationRecipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (user) {
            fetchCommunications();
        }
    }, [user]);

    const fetchCommunications = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('communication_recipients')
                .select(`
                    *,
                    communication:communications (
                        *,
                        channel:communication_channels (*),
                        sender_profile:profiles (name)
                    )
                `)
                .eq('guardian_id', user?.id)
                .eq('is_archived', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRecipients(data as CommunicationRecipient[]);
        } catch (error) {
            console.error('Error fetching communications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCardClick = async (recipient: CommunicationRecipient) => {
        // optimistically update read status
        if (!recipient.read_at) {
            // In background, mark as read
            supabase.from('communication_recipients')
                .update({ read_at: new Date().toISOString() })
                .eq('id', recipient.id)
                .then(({ error }) => {
                    if (error) console.error("Error marking as read", error);
                });

            // Update local state
            setRecipients(prev => prev.map(r =>
                r.id === recipient.id ? { ...r, read_at: new Date().toISOString() } : r
            ));
        }

        // Navigate to details
        navigate(`/pais/comunicados/${recipient.communication_id}`);
    };

    const filteredRecipients = recipients.filter((r, index, self) => {
        const title = r.communication?.title.toLowerCase() || '';
        const sender = r.communication?.channel?.name.toLowerCase() || '';
        const search = searchTerm.toLowerCase();

        // Deduplicate by communication_id
        const isFirstOccurrence = self.findIndex(t => t.communication_id === r.communication_id) === index;

        return isFirstOccurrence && (title.includes(search) || sender.includes(search));
    });

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white px-4 py-3 sticky top-0 z-10 border-b border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-xl font-bold text-gray-800">Comunicados</h1>
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                        {recipients.filter(r => !r.read_at).length}
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por palavras-chave"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-100/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 text-gray-700 font-medium placeholder:text-gray-400"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {/* Filter icon could go here */}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-blue-500" />
                    </div>
                ) : filteredRecipients.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <p>Nenhum comunicado encontrado.</p>
                    </div>
                ) : (
                    filteredRecipients.map(recipient => (
                        <CommunicationCard
                            key={recipient.id}
                            recipient={recipient}
                            onClick={() => handleCardClick(recipient)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default CommunicationsInbox;
