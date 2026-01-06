import { type FC, useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, MapPin, Clock, History } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format, isValid, isBefore, startOfDay, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Event {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    type: 'academic' | 'holiday' | 'meeting' | 'other';
    location?: string;
}

type FilterType = 'all' | 'academic' | 'holiday' | 'meeting';

const CalendarSkeleton = () => (
    <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((item) => (
            <div key={item} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-5 bg-gray-100 rounded-full w-20"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
        ))}
    </div>
);

export const ParentCalendar: FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = useCallback(async () => {
        try {
            setLoading(true);
            // Fetch events from 3 months ago to cover recent history
            const startHistory = subMonths(new Date(), 3).toISOString();

            const { data, error } = await supabase
                .from('events')
                .select('*')
                .gte('start_time', startHistory)
                .order('start_time', { ascending: true }) // Default order, we sort manually later
                .limit(200); // Increased limit to cover history + future

            if (error) throw error;
            setEvents(data || []);
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const getEventBadgeStyle = (type: string, isPast: boolean) => {
        if (isPast) return 'bg-gray-100 text-gray-500';
        switch (type) {
            case 'academic': return 'bg-blue-100 text-blue-700';
            case 'holiday': return 'bg-red-100 text-red-700';
            case 'meeting': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getEventLabel = (type: string) => {
        switch (type) {
            case 'academic': return '📅 Acadêmico';
            case 'holiday': return '🎉 Feriado';
            case 'meeting': return '👥 Reunião';
            default: return '📌 Outro';
        }
    };

    const now = startOfDay(new Date());

    const filteredEvents = events.filter(event => {
        if (filter === 'all') return true;
        return event.type === filter;
    });

    // Separate Future and Past events
    const futureEvents = filteredEvents
        .filter(e => !isBefore(new Date(e.start_time), now))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const pastEvents = filteredEvents
        .filter(e => isBefore(new Date(e.start_time), now))
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()); // Descending (most recent past first)

    const renderEventCard = (event: Event, isPast: boolean) => {
        const dateObj = new Date(event.start_time);
        const dateStr = isValid(dateObj)
            ? format(dateObj, "EEEE, d 'de' MMMM", { locale: ptBR })
            : 'Data inválida';
        const timeStr = isValid(dateObj) ? format(dateObj, 'HH:mm') : '--:--';

        return (
            <div
                key={event.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden p-4 group transition-all ${isPast
                    ? 'border-gray-100 grayscale hover:grayscale-0 opacity-70 hover:opacity-100' // Past style
                    : 'border-gray-200 hover:shadow-md' // Future style
                    }`}
            >
                {/* Header: Date + Badge */}
                <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-3">
                    <h2 className={`text-sm font-bold capitalize ${isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                        {dateStr}
                    </h2>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${getEventBadgeStyle(event.type, isPast)}`}>
                        {getEventLabel(event.type).replace(/^[^\s]+\s/, '')}
                    </span>
                </div>

                {/* Content */}
                <div className="space-y-2">
                    <h3 className={`font-bold text-lg leading-tight ${isPast ? 'text-gray-500' : 'text-gray-900'}`}>
                        {event.title}
                    </h3>

                    {event.description && (
                        <p className={`text-sm line-clamp-2 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                            {event.description}
                        </p>
                    )}

                    {/* Footer Details */}
                    <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${isPast ? 'bg-gray-50' : 'bg-gray-50'}`}>
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-mono font-medium">{timeStr}</span>
                        </div>

                        {event.location && (
                            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                <span className="truncate max-w-[150px]">{event.location}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
            {/* Header - Fixed */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarIcon className="w-6 h-6 text-brand-600" />
                        Agenda
                    </h1>
                    <p className="text-gray-600 text-sm">Próximos eventos e atividades</p>
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all ${filter === 'all'
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300'
                        }`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setFilter('academic')}
                    className={`px-4 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all ${filter === 'academic'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                        }`}
                >
                    📅 Acadêmico
                </button>
                <button
                    onClick={() => setFilter('meeting')}
                    className={`px-4 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all ${filter === 'meeting'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
                        }`}
                >
                    👥 Reuniões
                </button>
                <button
                    onClick={() => setFilter('holiday')}
                    className={`px-4 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all ${filter === 'holiday'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300'
                        }`}
                >
                    🎉 Feriados
                </button>
            </div>

            {/* Content Area */}
            {loading ? (
                <CalendarSkeleton />
            ) : filteredEvents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center animate-fade-in">
                    <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {filter === 'all' ? 'Nenhum evento encontrado' : `Sem eventos de ${getEventLabel(filter)}`}
                    </h3>
                    <p className="text-gray-500 text-sm max-w-[200px] mx-auto">
                        Não encontramos eventos para este filtro.
                    </p>
                </div>
            ) : (
                <div className="space-y-8 animate-fade-in">

                    {/* Future Events Section */}
                    {futureEvents.length > 0 && (
                        <div className="space-y-4">
                            {/* Only show header if we have past events too, otherwise it's just 'the list' */}
                            {pastEvents.length > 0 && (
                                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider pl-1">
                                    Próximos Eventos
                                </h2>
                            )}
                            {futureEvents.map(event => renderEventCard(event, false))}
                        </div>
                    )}

                    {/* Empty Future State */}
                    {futureEvents.length === 0 && pastEvents.length > 0 && filter === 'all' && (
                        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                            <h3 className="text-gray-900 font-medium">Sem próximos eventos</h3>
                            <p className="text-gray-500 text-sm">Mas você pode ver o histórico abaixo.</p>
                        </div>
                    )}

                    {/* Past Events Section */}
                    {pastEvents.length > 0 && (
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <History className="w-4 h-4 text-gray-400" />
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                                    Histórico Recente
                                </h2>
                            </div>
                            <div className="opacity-80 hover:opacity-100 transition-opacity duration-300 space-y-4">
                                {pastEvents.map(event => renderEventCard(event, true))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
