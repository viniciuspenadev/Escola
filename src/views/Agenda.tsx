
import { type FC, useState, useEffect } from 'react';
import { Button, Modal, Input } from '../components/ui';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Clock,
    Trash2,
    MoreHorizontal,
    CheckCircle2,
    Image as ImageIcon,
    Upload
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

// Constants
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface Event {
    id?: string;
    title: string;
    description?: string;
    start_time: string; // ISO string
    type: 'academic' | 'holiday' | 'meeting' | 'other' | 'generic';
    // Mural Fields
    category?: 'event' | 'notice' | 'alert' | 'mural';
    is_pinned?: boolean;
    class_id?: string | null;
    show_on_mural?: boolean;
    image_url?: string;
}

interface ClassOption {
    id: string;
    name: string;
    shift: string;
}

import { useAuth } from '../contexts/AuthContext';

export const AgendaView: FC = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const [viewDate, setViewDate] = useState(new Date());
    const [events, setEvents] = useState<Event[]>([]);
    const [classes, setClasses] = useState<ClassOption[]>([]);

    // Filter State
    const [filterType, setFilterType] = useState<'all' | 'academic' | 'holiday' | 'meeting'>('all');
    const [filterAudience, setFilterAudience] = useState<'all' | 'my_classes'>('all');

    // Timeline State
    const [timelineTab, setTimelineTab] = useState<'upcoming' | 'past'>('upcoming');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<Event>({
        title: '',
        start_time: '',
        type: 'academic',
        category: 'event', // Default
        is_pinned: false,
        class_id: null,
        description: '',
        show_on_mural: false,
        image_url: ''
    });
    const [uploading, setUploading] = useState(false);

    // Smart Chip Styles Helper
    const getEventStyle = (type: string, category?: string) => {
        // Base styles for the chip
        const base = "text-[10px] sm:text-xs px-2 py-1 rounded truncate border flex items-center gap-1.5 transition-all hover:bg-opacity-80";

        // Specific styles
        if (category === 'notice') return `${base} bg-yellow-50 text-yellow-700 border-yellow-200`;
        if (category === 'alert') return `${base} bg-red-50 text-red-700 border-red-200`;

        switch (type) {
            case 'academic': return `${base} bg-blue-50 text-blue-700 border-blue-200`;
            case 'holiday': return `${base} bg-red-50 text-red-700 border-red-200`;
            case 'meeting': return `${base} bg-purple-50 text-purple-700 border-purple-200`;
            default: return `${base} bg-gray-50 text-gray-700 border-gray-200`;
        }
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'academic': return '📚';
            case 'holiday': return '🎉';
            case 'meeting': return '👥';
            default: return '📌';
        }
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const fetchEvents = async () => {
        const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString();
        const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const { data, error } = await supabase
            .from('events')
            .select('*')
            .gte('start_time', start)
            .lte('start_time', end)
            .order('start_time');

        if (error) console.error(error);
        if (data) setEvents(data);
    };

    useEffect(() => {
        const fetchClasses = async () => {
            const currentYear = new Date().getFullYear();
            let query = supabase
                .from('classes')
                .select('id, name, shift, class_teachers!inner(teacher_id)')
                .eq('school_year', currentYear)
                .order('name');

            if (user?.role === 'TEACHER') {
                // @ts-ignore - Supabase types inference can be tricky with inner joins
                query = query.eq('class_teachers.teacher_id', user.id);
            }

            const { data } = await query;
            if (data) {
                // @ts-ignore
                setClasses(data.map((c: any) => ({ id: c.id, name: c.name, shift: c.shift })));
            }
        };
        if (user) fetchClasses();
    }, [user]);

    useEffect(() => {
        fetchEvents();
    }, [viewDate]);

    // Handlers
    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const openCreateModal = () => {
        setIsEditing(false);
        const now = new Date();
        const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        setCurrentEvent({
            title: '',
            start_time: `${defaultDate}T08:00:00`,
            type: 'academic',
            category: 'event',
            is_pinned: false,
            // If teacher, default to first class, else global
            class_id: user?.role === 'TEACHER' && classes.length > 0 ? classes[0].id : null,
            description: ''
        });
        setShowModal(true);
    };

    const openEditModal = (event: Event) => {
        setIsEditing(true);
        setCurrentEvent(event);
        setShowModal(true);
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        try {
            setUploading(true);
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data } = supabase.storage.from('photos').getPublicUrl(filePath);

            setCurrentEvent(prev => ({ ...prev, image_url: data.publicUrl }));
            addToast('success', 'Imagem enviada com sucesso!');
        } catch (error: any) {
            addToast('error', 'Erro ao enviar imagem: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSaveEvent = async () => {
        if (!currentEvent.title) return addToast('error', 'Título obrigatório');

        try {
            // Reconstruct ISO string from form inputs
            const datePart = currentEvent.start_time.split('T')[0];
            const timePart = currentEvent.start_time.includes('T') ? currentEvent.start_time.split('T')[1].substring(0, 5) : '08:00';
            const finalIso = new Date(`${datePart}T${timePart}:00`).toISOString();

            const payload = {
                title: currentEvent.title,
                description: currentEvent.description,
                start_time: finalIso,
                type: currentEvent.type,
                // Mural Fields
                category: currentEvent.category || 'event',
                is_pinned: currentEvent.is_pinned || false,
                class_id: currentEvent.class_id === 'global' ? null : currentEvent.class_id,
                show_on_mural: currentEvent.show_on_mural || false,
                image_url: currentEvent.image_url || null
            };

            let error;
            if (isEditing && currentEvent.id) {
                const res = await supabase.from('events').update(payload).eq('id', currentEvent.id);
                error = res.error;
            } else {
                const res = await supabase.from('events').insert(payload);
                error = res.error;
            }

            if (error) throw error;

            addToast('success', isEditing ? 'Evento atualizado!' : 'Evento criado!');
            setShowModal(false);
            fetchEvents();
        } catch (error: any) {
            addToast('error', 'Erro ao salvar: ' + error.message);
        }
    };

    const handleDeleteEvent = async () => {
        if (!currentEvent.id) return;

        const isConfirmed = await confirm({
            title: 'Excluir Evento',
            message: 'Tem certeza que deseja excluir este evento?',
            type: 'danger',
            confirmText: 'Excluir'
        });

        if (!isConfirmed) return;

        try {
            const { error } = await supabase.from('events').delete().eq('id', currentEvent.id);
            if (error) throw error;
            addToast('success', 'Evento excluído');
            setShowModal(false);
            fetchEvents();
        } catch (error: any) {
            addToast('error', 'Erro ao excluir: ' + error.message);
        }
    };

    // Render Logic
    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
        const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
        const days = [];

        // Empty cells
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[100px] bg-gray-50/30 border border-gray-100" />);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const currentDateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayEvents = events.filter(e => e.start_time.startsWith(currentDateStr));
            const isToday = new Date().toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), i).toDateString();

            days.push(
                <div
                    key={i}
                    className={`min-h-[100px] border border-gray-100 p-2 transition-all relative group bg-white hover:bg-gray-50`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-brand-600 text-white shadow-md transform scale-105' : 'text-gray-700'}
                       `}>
                            {i}
                        </span>
                    </div>

                    {/* Event Stack */}
                    <div className="flex flex-col gap-1 mt-1">
                        {dayEvents
                            .filter(ev => {
                                if (filterType !== 'all' && ev.type !== filterType) return false;
                                return true;
                            })
                            .slice(0, 3).map((ev) => (
                                <div
                                    key={ev.id}
                                    onClick={(e) => { e.stopPropagation(); openEditModal(ev); }}
                                    className={getEventStyle(ev.type, ev.category)}
                                    title={ev.title}
                                >
                                    <span className="shrink-0 text-[10px]">{getEventIcon(ev.type)}</span>
                                    <span className="font-semibold truncate">{ev.title}</span>
                                    {ev.is_pinned && <span className="ml-auto text-[9px] opacity-70">📌</span>}
                                </div>
                            ))}
                        {dayEvents.length > 3 && (
                            <div className="text-[10px] text-gray-400 pl-1">
                                + {dayEvents.length - 3} mais
                            </div>
                        )}
                    </div>

                    {/* Hover Add Button */}
                    <button
                        onClick={() => {
                            setCurrentEvent({
                                title: '',
                                start_time: `${currentDateStr}T08:00:00`,
                                type: 'academic',
                                description: ''
                            });
                            setShowModal(true);
                        }}
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-gray-100 hover:bg-brand-100 text-gray-500 hover:text-brand-600 rounded-full transition-all"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex gap-6 animate-fade-in relative pb-10">
            {/* Main Calendar Area - 3/4 width */}
            <div className="flex-1 flex flex-col gap-4 h-full">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Agenda Escolar</h1>
                        <p className="text-gray-500">Organização e planejamento.</p>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-2">
                            <span className="text-xs font-bold text-gray-400 uppercase px-2">Tipo:</span>

                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${filterType === 'all' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Tudo
                            </button>
                            <button
                                onClick={() => setFilterType('academic')}
                                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${filterType === 'academic' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                {filterType === 'academic' && <CheckCircle2 className="w-3 h-3" />} Acadêmico
                            </button>
                            <button
                                onClick={() => setFilterType('holiday')}
                                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${filterType === 'holiday' ? 'bg-red-100 text-red-700' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                {filterType === 'holiday' && <CheckCircle2 className="w-3 h-3" />} Feriados
                            </button>
                        </div>

                        {/* Audience Filter (Only for Teachers) */}
                        {user?.role === 'TEACHER' && (
                            <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-2">
                                <span className="text-xs font-bold text-gray-400 uppercase px-2">Ver:</span>
                                <button
                                    onClick={() => setFilterAudience('all')}
                                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${filterAudience === 'all' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setFilterAudience('my_classes')}
                                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${filterAudience === 'my_classes' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Minhas Turmas
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0 rounded-lg">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="min-w-[140px] text-center font-bold text-gray-800 text-sm capitalize select-none">
                                {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                            </span>
                            <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0 rounded-lg">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                        {DAYS.map(day => (
                            <div key={day} className="py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto">
                        {renderCalendar()}
                    </div>
                </div>
            </div>

            {/* Timeline Sidebar - 1/4 width */}
            <div className="w-80 flex flex-col gap-4 h-full">
                <div className="flex justify-between items-center h-[54px] mb-2">
                    <span className="text-lg font-bold text-gray-900 capitalize flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-400" />
                        Linha do Tempo
                    </span>
                    <Button size="sm" onClick={openCreateModal} className="w-8 h-8 p-0 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-brand">
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>

                {/* Timeline Tabs */}
                <div className="flex p-1 bg-gray-100 rounded-lg mb-2">
                    <button
                        onClick={() => setTimelineTab('upcoming')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${timelineTab === 'upcoming' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Próximos
                    </button>
                    <button
                        onClick={() => setTimelineTab('past')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${timelineTab === 'past' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Arquivados
                    </button>
                </div>

                <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    {events.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                            <Clock className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm">Nenhum evento neste mês.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {(() => {
                                // Sort by time
                                const sortedEvents = [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                                // Filter Logic
                                let displayEvents = sortedEvents.filter(ev => {
                                    const eventDate = new Date(ev.start_time);
                                    if (timelineTab === 'upcoming') {
                                        // Show items from today onwards (ignore time for "today" inclusion, but logically we want what's relevant)
                                        // Actually "Upcoming" usually means valid for future. Let's include everything from Today 00:00
                                        const todayStart = new Date();
                                        todayStart.setHours(0, 0, 0, 0);
                                        return eventDate >= todayStart;
                                    } else {
                                        // Past
                                        const todayStart = new Date();
                                        todayStart.setHours(0, 0, 0, 0);
                                        return eventDate < todayStart;
                                    }
                                });

                                // Reverse past events to show most recent first? No, usually standard chronological is fine or reverse chronological for history.
                                // Let's keep chronological but maybe reverse for past? User said "Arquivados". Usually reverse chronological.
                                if (timelineTab === 'past') {
                                    displayEvents = displayEvents.reverse();
                                }

                                if (displayEvents.length === 0) {
                                    return (
                                        <div className="text-center py-10 text-gray-400">
                                            <p className="text-sm">Nenhum evento {timelineTab === 'upcoming' ? 'próximo' : 'arquivado'}.</p>
                                        </div>
                                    );
                                }

                                // Grouping
                                const groupedEvents: { [key: string]: Event[] } = {};
                                displayEvents.forEach(ev => {
                                    const dateKey = new Date(ev.start_time).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' });
                                    if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
                                    groupedEvents[dateKey].push(ev);
                                });

                                let foundNext = false; // Flag to mark only the VERY FIRST event as "Next"

                                return Object.entries(groupedEvents).map(([dateStr, dateEvents]) => {
                                    // Check if this group is TODAY
                                    const sampleDate = new Date(dateEvents[0].start_time);
                                    const isToday = sampleDate.toDateString() === new Date().toDateString();

                                    return (
                                        <div key={dateStr} className="animate-fade-in relative pl-4 border-l border-gray-100">
                                            {/* Date Header */}
                                            <div className={`absolute left-[-4px] top-1.5 w-2 h-2 rounded-full ${isToday ? 'bg-brand-500 ring-4 ring-brand-100' : 'bg-gray-300'}`} />

                                            <div className="flex items-center gap-2 mb-2">
                                                <h5 className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-brand-600' : 'text-gray-400'}`}>
                                                    {isToday ? 'Hoje' : dateStr}
                                                </h5>
                                                {isToday && <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 rounded font-bold">AGORA</span>}
                                            </div>

                                            <div className="space-y-3">
                                                {dateEvents.map(ev => {
                                                    const time = new Date(ev.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                                                    // Determine if "Next"
                                                    // If tab is upcoming, and we haven't found next yet, and event is in future (or today)
                                                    // Actually simply the first item of 'upcoming' list is the next one.
                                                    const isNext = !foundNext && timelineTab === 'upcoming' && new Date(ev.start_time) > new Date();
                                                    if (isNext) foundNext = true;

                                                    return (
                                                        <div
                                                            key={ev.id}
                                                            onClick={() => openEditModal(ev)}
                                                            className={`group bg-white border rounded-lg p-2.5 cursor-pointer transition-all relative
                                                            ${isNext ? 'border-brand-200 shadow-md ring-1 ring-brand-100' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm hover:bg-gray-50'}
                                                        `}
                                                        >
                                                            {isNext && (
                                                                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10">
                                                                    PRÓXIMO
                                                                </div>
                                                            )}

                                                            <div className="flex justify-between items-start mb-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm">{getEventIcon(ev.type)}</span>
                                                                    <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${isNext ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>{time}</span>
                                                                </div>
                                                                <MoreHorizontal className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100" />
                                                            </div>
                                                            <h4 className={`font-bold text-sm leading-tight mb-1 ${isNext ? 'text-brand-900' : 'text-gray-900'}`}>{ev.title}</h4>

                                                            {ev.class_id && (
                                                                <span className="inline-block text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 mr-2">
                                                                    {classes.find(c => c.id === ev.class_id)?.name || 'Turma'}
                                                                </span>
                                                            )}

                                                            {ev.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{ev.description}</p>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Create/Edit */}
            {showModal && (
                <Modal
                    isOpen={showModal}
                    title={isEditing ? 'Editar Evento' : 'Novo Evento'}
                    onClose={() => setShowModal(false)}
                    footer={
                        <div className="flex justify-between items-center w-full">
                            {isEditing && currentEvent.id ? (
                                <Button variant="danger" onClick={handleDeleteEvent} className="text-red-600 bg-red-50 border-red-100 hover:bg-red-100">
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </Button>
                            ) : <div />}

                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
                                <Button onClick={handleSaveEvent} className="bg-brand-600 text-white">
                                    {isEditing ? 'Salvar Alterações' : 'Criar Evento'}
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <Input
                            label="Título / Assunto"
                            placeholder="Ex: Reunião Pedagógica, Aviso de Passeio..."
                            value={currentEvent.title}
                            onChange={e => setCurrentEvent({ ...currentEvent, title: e.target.value })}
                        />

                        {/* Mural Options */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Categoria</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
                                    value={currentEvent.category || 'event'}
                                    onChange={e => setCurrentEvent({ ...currentEvent, category: e.target.value as any })}
                                >
                                    <option value="event">📅 Evento de Agenda</option>
                                    <option value="notice">📝 Aviso / Comunicado</option>
                                    <option value="alert">🚨 Alerta Urgente</option>
                                </select>
                            </div>

                            {/* Mural Toggle & Image */}
                            <div className="col-span-2 border-t border-gray-200 pt-3 mt-1">
                                <label className="flex items-center gap-2 cursor-pointer select-none mb-3">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        checked={currentEvent.show_on_mural || false}
                                        onChange={e => setCurrentEvent({ ...currentEvent, show_on_mural: e.target.checked })}
                                    />
                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1">
                                        <ImageIcon className="w-4 h-4" />
                                        Publicar Destaque no Mural (Carrossel)
                                    </span>
                                </label>

                                {currentEvent.show_on_mural && (
                                    <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors relative">
                                        {currentEvent.image_url ? (
                                            <div className="relative group">
                                                <img src={currentEvent.image_url} alt="Preview" className="h-32 w-full object-cover rounded-md mx-auto" />
                                                <button
                                                    onClick={() => setCurrentEvent({ ...currentEvent, image_url: '' })}
                                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="cursor-pointer block">
                                                <div className="flex flex-col items-center gap-1 text-gray-500">
                                                    {uploading ? (
                                                        <Clock className="w-8 h-8 animate-spin text-brand-500" />
                                                    ) : (
                                                        <Upload className="w-8 h-8 text-gray-300" />
                                                    )}
                                                    <span className="text-xs font-medium">Click para enviar imagem de capa</span>
                                                </div>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    disabled={uploading}
                                                />
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Audience */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Público Alvo</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white"
                                value={currentEvent.class_id || 'global'}
                                onChange={e => setCurrentEvent({ ...currentEvent, class_id: e.target.value === 'global' ? null : e.target.value })}
                            >
                                {user?.role !== 'TEACHER' && (
                                    <option value="global">🌍 Toda a Escola (Global)</option>
                                )}
                                <optgroup label="Turmas Específicas">
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name} ({cls.shift})</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>


                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Data"
                                type="date"
                                value={currentEvent.start_time.split('T')[0]}
                                onChange={e => {
                                    // Preserve time
                                    const oldTime = currentEvent.start_time.split('T')[1] || '08:00:00';
                                    setCurrentEvent({ ...currentEvent, start_time: `${e.target.value}T${oldTime}` })
                                }}
                            />
                            <Input
                                label="Horário"
                                type="time"
                                value={currentEvent.start_time.includes('T') ? currentEvent.start_time.split('T')[1].substring(0, 5) : '08:00'}
                                onChange={e => {
                                    const datePart = currentEvent.start_time.split('T')[0];
                                    setCurrentEvent({ ...currentEvent, start_time: `${datePart}T${e.target.value}:00` })
                                }}
                            />
                        </div>

                        {/* Hide Type if it's a Notice? No, let's keep it for color coding calendars too */}
                        {currentEvent.category === 'event' && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tipo de Evento</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none"
                                    value={currentEvent.type}
                                    onChange={e => setCurrentEvent({ ...currentEvent, type: e.target.value as any })}
                                >
                                    <option value="academic">📅 Acadêmico</option>
                                    <option value="holiday">🎉 Feriado/Recesso</option>
                                    <option value="meeting">👥 Reunião</option>
                                    <option value="other">📌 Outro</option>
                                </select>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Descrição / Detalhes</label>
                            <textarea
                                className="w-full border border-gray-300 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none min-h-[120px] resize-y"
                                placeholder="Escreva os detalhes aqui... Pule linhas para criar parágrafos."
                                value={currentEvent.description || ''}
                                onChange={e => setCurrentEvent({ ...currentEvent, description: e.target.value })}
                            />
                        </div>
                    </div>
                </Modal>
            )
            }
        </div >
    );
};
