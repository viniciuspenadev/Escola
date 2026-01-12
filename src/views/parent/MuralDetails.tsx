import { type FC, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MuralEvent {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    image_url?: string;
    category?: 'event' | 'notice' | 'alert' | 'mural';
    location?: string;
    type?: string;
}

export const MuralDetails: FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState<MuralEvent | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchEvent();
    }, [id]);

    const fetchEvent = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setEvent(data);
        } catch (error) {
            console.error('Error fetching event:', error);
            navigate('/pais/home'); // Fallback
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>;
    }

    if (!event) return null;

    const eventDate = new Date(event.start_time);

    return (
        <div className="min-h-screen bg-white pb-20 animate-fade-in relative">
            {/* Hero Section */}
            <div className={`relative w-full ${event.image_url ? 'h-[45vh]' : 'h-[25vh]'} transition-all duration-700`}>
                {event.image_url ? (
                    <>
                        <img
                            src={event.image_url}
                            alt={event.title}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-white" />
                    </>
                ) : (
                    <div className={`w-full h-full ${event.category === 'alert' ? 'bg-gradient-to-br from-red-500 to-red-700' :
                        event.category === 'notice' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                            'bg-gradient-to-br from-brand-600 to-indigo-700'
                        }`}>
                        <div className="absolute inset-0 bg-black/10" />
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
                    </div>
                )}

                {/* Back Button (Floating) */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 z-20 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-md transition-all active:scale-95"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </div>

            {/* Content Container (Overlapping Hero) */}
            <div className="relative z-10 -mt-16 px-5 space-y-6">

                {/* Header Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-lg rounded-3xl p-6">
                    {/* Badge */}
                    <div className="flex items-center justify-between mb-4">
                        <span className={`
                            text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1.5
                            ${event.category === 'alert' ? 'bg-red-100 text-red-700' :
                                event.category === 'notice' ? 'bg-amber-100 text-amber-700' :
                                    'bg-brand-100 text-brand-700'}
                        `}>
                            {event.category === 'alert' ? <AlertCircle className="w-3 h-3" /> :
                                event.category === 'notice' ? <AlertCircle className="w-3 h-3" /> : // Notice icon
                                    <CheckCircle2 className="w-3 h-3" />}
                            {event.category === 'alert' ? 'Alerta Urgente' :
                                event.category === 'notice' ? 'Aviso Importante' : 'Destaque'}
                        </span>

                        <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                            {format(eventDate, "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                    </div>

                    <h1 className="text-2xl font-black text-gray-900 leading-tight mb-2">
                        {event.title}
                    </h1>

                    <div className="flex items-center gap-4 text-gray-500 text-sm mt-3 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-brand-500" />
                            <span className="capitalize">{format(eventDate, 'EEEE', { locale: ptBR })}</span>
                        </div>
                        {event.category === 'event' && (
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-brand-500" />
                                <span>{format(eventDate, 'HH:mm')}</span>
                            </div>
                        )}
                        {event.location && (
                            <div className="flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-brand-500" />
                                <span>{event.location}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Body Text */}
                <div className="px-1 rich-text">
                    <p className="text-gray-700 text-base leading-relaxed whitespace-pre-wrap font-book">
                        {event.description || 'Sem descrição.'}
                    </p>
                </div>

                {/* Optional Action Area */}
                <div className="pt-8 text-center opacity-50">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Escola V2 • Mural Digital</p>
                </div>

            </div>
        </div>
    );
};
