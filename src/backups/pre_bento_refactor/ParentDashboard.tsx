import { type FC, useEffect, useState } from 'react';
import {
    CreditCard, AlertCircle, CheckCircle2,
    Utensils, Moon, Smile, Baby, Clock, MoreHorizontal, MessageCircle
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useStudent } from '../../contexts/StudentContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useNavigate } from 'react-router-dom';
import { planningService } from '../../services/planningService';
import { DailyTimelineComponent } from '../../components/parent/DailyTimeline';
import { DailyTimelineVertical } from '../../components/parent/DailyTimelineVertical';
import { useAppSettings } from '../../hooks/useAppSettings';

interface DashboardData {
    studentProfile: {
        name: string;
        photo_url?: string;
        class_name?: string;
    };
    smartBanner: {
        type: 'finance-overdue' | 'event-today' | 'finance-warning' | 'mural-highlight' | 'empty';
        title: string;
        message: string;
        actionLabel?: string;
        actionLink?: string;
        imageUrl?: string;
        data?: any;
    };
    dailyHighlights: {
        hasData: boolean;
        food: string;
        sleep: string;
        mood: string;
        bathroom: string;
    };
    feed: FeedItem[];
    todaysClasses?: any[];
    isTomorrowMode?: boolean;
}

interface FeedItem {
    id: string;
    type: 'grade' | 'attendance' | 'event' | 'finance' | 'diary' | 'notice' | 'alert';
    title: string;
    today: boolean;
    isClassSpecific: boolean;
    date: Date;
    description?: string;
    value?: string;
    status?: 'good' | 'bad' | 'neutral' | 'info';
    is_pinned?: boolean;
    location?: string;
}

export const ParentDashboard: FC = () => {
    const { user } = useAuth();
    const { selectedStudent } = useStudent();
    const navigate = useNavigate();
    const { value: timelineMode } = useAppSettings('daily_timeline_display_mode', 'card');
    const [loading, setLoading] = useState(true);
    // const [currentBannerIndex, setCurrentBannerIndex] = useState(0); // Removed
    const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
    const [data, setData] = useState<DashboardData & { smartBanners: any[] }>({
        studentProfile: { name: '' },
        smartBanner: { type: 'empty', title: '', message: '' }, // Deprecated but kept for type safety if needed, utilizing smartBanners instead
        smartBanners: [],
        dailyHighlights: { hasData: false, food: '-', sleep: '-', mood: '-', bathroom: '-' },
        feed: []
    });

    useEffect(() => {
        if (!user) return;
        if (!selectedStudent) {
            setLoading(false);
            return;
        }
        fetchDashboardData();
    }, [user, selectedStudent]);

    // Carousel Auto-Rotation Removed (Mural is now scrollable)
    // useEffect(() => {
    //     if (data.smartBanners.length <= 1) return;
    //     const interval = setInterval(() => {
    //         setCurrentBannerIndex(prev => (prev + 1) % data.smartBanners.length);
    //     }, 5000);
    //     return () => clearInterval(interval);
    // }, [data.smartBanners]);

    const fetchDashboardData = async () => {
        if (!selectedStudent) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const studentId = selectedStudent.id;
            // 2. Smart Banner Logic (Collection)
            const banners: any[] = [];

            // Check Overdue Finance (Priority 1) - GLOBAL CHECK (All Years)
            // First, get ALL enrollment IDs for this student to check past debts too
            const { data: allEnrollments } = await supabase
                .from('enrollments')
                .select('id')
                .eq('student_id', studentId);

            const allEnrollmentIds = allEnrollments?.map(e => e.id) || [selectedStudent.enrollment_id];


            const todayStr = format(new Date(), 'yyyy-MM-dd');

            // Fetch ALL pending installments that are older than today
            const { data: overdue } = await supabase
                .from('installments')
                .select('*')
                .in('enrollment_id', allEnrollmentIds)
                .eq('status', 'pending') // Items are still marked as pending in DB
                .lt('due_date', todayStr) // But due date is in the past
                .order('due_date', { ascending: true }) // Oldest debt first
                .limit(1);

            if (overdue && overdue.length > 0) {
                banners.push({
                    type: 'finance-overdue',
                    title: 'Mensalidade em Atraso',
                    message: `Fatura de R$ ${overdue[0].value} venceu em ${format(new Date(overdue[0].due_date), 'dd/MM/yyyy')}.`,
                    actionLabel: 'Pagar Agora',
                    actionLink: '/pais/financeiro'
                });
            }

            // Check Events Today (Priority 2)
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const { data: eventsToday } = await supabase
                .from('events')
                .select('*')
                .gte('start_time', startOfDay.toISOString())
                .lte('start_time', endOfDay.toISOString())
                .limit(1);

            if (eventsToday && eventsToday.length > 0) {
                banners.push({
                    type: 'event-today',
                    title: eventsToday[0].title, // Show Event Title as main Title
                    message: eventsToday[0].location ? `Local: ${eventsToday[0].location}` : 'Confira os detalhes na agenda.', // Show details as message
                    actionLabel: 'Ver Agenda',
                    actionLink: '/pais/agenda',
                    data: eventsToday[0]
                });
            }

            // Check Upcoming Bills (Priority 3)
            const { data: upcoming } = await supabase
                .from('installments')
                .select('*')
                .eq('enrollment_id', selectedStudent.enrollment_id)
                .eq('status', 'pending')
                .order('due_date', { ascending: true })
                .limit(1);

            if (upcoming && upcoming.length > 0) {
                const days = Math.ceil((new Date(upcoming[0].due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                if (days <= 5 && days >= 0) {
                    banners.push({
                        type: 'finance-warning',
                        title: 'Fatura Próxima',
                        message: `Vence em ${days} dia${days !== 1 ? 's' : ''}`,
                        actionLabel: 'Ver Fatura',
                        actionLink: '/pais/financeiro'
                    });
                }
            }


            // 2.5 Mural Highlights (New!) 🎨
            const { data: muralHighlights } = await supabase
                .from('events')
                .select('*')
                .eq('show_on_mural', true)
                .order('start_time', { ascending: false }) // Show newest/future first, or maybe by creation? Let's use start_time desc (Newest events)
                .limit(5); // Limit to 5 items to not flood carousel

            if (muralHighlights) {
                muralHighlights.forEach(h => {
                    banners.push({
                        type: 'mural-highlight',
                        title: h.title,
                        message: h.description || '',
                        imageUrl: h.image_url,
                        actionLabel: 'Ver Detalhes',
                        actionLink: `/pais/mural/${h.id}`,
                        data: h
                    });
                });
            }

            // Fallback empty banner if none found (optional: or just show nothing? UI seems to expect one)
            // Existing logic had 'empty' type.
            // If empty, we can just leave array empty and not render banner section.

            // 3. Daily Highlights (Today's Diary)
            // todayStr is already defined above
            const { data: todayDiary } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('student_id', studentId)
                .eq('date', todayStr)
                .maybeSingle();

            const dailyHighlights = {
                hasData: !!todayDiary,
                food: 'Sem dados',
                sleep: 'Sem dados',
                mood: 'Sem dados',
                bathroom: 'Sem dados'
            };

            if (todayDiary && todayDiary.routine_data) {
                const r = todayDiary.routine_data as any;

                // Parse mood
                dailyHighlights.mood = r.mood || 'Sem dados';

                // Parse meals (lunch or snack)
                if (r.meals) {
                    const lunch = r.meals.lunch || '';
                    const snack = r.meals.snack || '';
                    // Extract emoji or first part
                    dailyHighlights.food = lunch || snack || 'Sem dados';
                }

                // Parse sleep (nap)
                if (r.sleep && r.sleep.nap) {
                    dailyHighlights.sleep = r.sleep.nap;
                }

                // Parse hygiene as bathroom indicator
                dailyHighlights.bathroom = r.hygiene || 'Sem dados';
                dailyHighlights.bathroom = r.hygiene || 'Sem dados';
            }

            // 3.5 Schedules Today (or Next School Day) - SMART LOGIC 🧠
            const now = new Date();
            const currentHour = now.getHours();
            const currentDay = now.getDay(); // 0 (Sun) - 6 (Sat)

            let targetDate = new Date(now);
            let isTomorrow = false;

            // Logic:
            // - If Weekday evening (> 13:00? No, let's say > 14:00 to catch afternoon shift end) -> Show Next Day
            // - If Friday afternoon -> Show Monday
            // - If Sat/Sun -> Show Monday

            if (currentDay === 6) { // Saturday
                targetDate.setDate(now.getDate() + 2); // -> Monday
                isTomorrow = true;
            } else if (currentDay === 0) { // Sunday
                targetDate.setDate(now.getDate() + 1); // -> Monday
                isTomorrow = true;
            } else if (currentDay === 5 && currentHour >= 13) { // Friday Afternoon
                targetDate.setDate(now.getDate() + 3); // -> Monday
                isTomorrow = true;
            } else if (currentHour >= 13) { // Mon-Thu Afternoon
                targetDate.setDate(now.getDate() + 1); // -> Next Day
                isTomorrow = true;
            }


            const targetYear = selectedStudent?.academic_year || new Date().getFullYear();

            // Get class (Active + Target Year)
            const { data: classRel } = await supabase
                .from('class_enrollments')
                .select('class_id, class:classes!inner(status, school_year)')
                .eq('student_id', studentId)
                .eq('class.status', 'active')
                .eq('class.school_year', targetYear)
                .limit(1)
                .maybeSingle();

            if (classRel) {
                // Use Planning Service to get REAL lesson plans
                // We will fetch this later in step 4 to avoid variable coloring issues
            }

            // 4. Mural Feed (Events + Notices) 📌
            // Logic: Pinned first, then by date (Newest Notices OR Closest Events)
            // For simplicity in MVP: Fetch all valid events/notices for this student
            const { data: muralEvents } = await supabase
                .from('events')
                .select('*')
                // Filter: Global OR Student's Class
                .or(`class_id.is.null,class_id.eq.${classRel?.class_id}`)
                .or(`is_pinned.eq.true,start_time.gte.${format(new Date(), 'yyyy-MM-dd')}T00:00:00`)
                .order('is_pinned', { ascending: false })
                .order('start_time', { ascending: true })
                .limit(20);

            const feed: FeedItem[] = (muralEvents || []).map(event => {
                const date = new Date(event.start_time);
                return {
                    id: event.id,
                    type: event.category === 'notice' || event.category === 'alert' ? event.category : 'event',
                    title: event.title,
                    description: event.description,
                    date: date,
                    today: new Date().toDateString() === date.toDateString(),
                    isClassSpecific: !!event.class_id,
                    is_pinned: event.is_pinned,
                    location: event.location,
                    eventType: event.type // pass the specific type (academic, etc)
                };
            });



            // 4. Today's Lesson Plans (For Timeline Widget)
            let todaysClasses: any[] = [];

            // Get current class enrollment first
            const { data: enrollment } = await supabase
                .from('class_enrollments')
                .select('class_id')
                .eq('student_id', selectedStudent.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (enrollment) {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                todaysClasses = await planningService.getLessonPlans(enrollment.class_id, todayStr, todayStr);
            }

            setData({
                studentProfile: {
                    name: selectedStudent.name,
                    photo_url: selectedStudent.photo_url,
                    class_name: selectedStudent.class_name
                },
                smartBanner: banners[0] || { type: 'empty' }, // Fallback for types
                smartBanners: banners,
                dailyHighlights,
                todaysClasses,
                isTomorrowMode: isTomorrow, // Pass this to UI
                feed // Feed is now populated
            });

        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div></div>;
    }




    // const activeBanner = data.smartBanners.length > 0 ? data.smartBanners[currentBannerIndex] : null;

    return (
        <div className="space-y-6 animate-fade-in pb-24">



            {/* 0. Push Notification Permission Banner */}
            {/* 0. Push Notification Permission Banner Removed - Replaced by Financial Alerts Strategy */}

            {/* 1. Finance / Critical Alerts (Top) 🚨 */}
            {/* 1. Finance / Critical Alerts (Top) 🚨 */}
            {(() => {
                const alert = data.smartBanners.find(b =>
                    (b.type === 'finance-overdue' || b.type === 'finance-warning') &&
                    !dismissedAlerts.includes(b.type + b.title)
                );

                if (!alert) return null;
                const isOverdue = alert.type === 'finance-overdue';

                return (
                    <div className={`
                    bg-gradient-to-r rounded-xl p-4 shadow-lg text-white text-white animate-fade-in flex items-center justify-between relative group mb-4
                    ${isOverdue ? 'from-red-600 to-red-800' : 'from-brand-600 to-brand-800'}
                `}>
                        {/* Dismiss Button */}
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                setDismissedAlerts(prev => [...prev, alert.type + alert.title]);
                            }}
                            className="absolute -top-2 -right-2 p-1 rounded-full shadow-sm bg-white text-gray-400 hover:text-red-500 z-10 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                                <AlertCircle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-white">
                                    {alert.title}
                                </h4>
                                <p className="text-xs text-white/90">
                                    {alert.message}
                                </p>
                            </div>
                        </div>
                        {alert.actionLink && (
                            <button
                                onClick={() => navigate(alert.actionLink!)}
                                className="bg-white text-brand-900 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-white/90 active:scale-95 transition-transform whitespace-nowrap ml-2"
                                style={{ color: isOverdue ? '#dc2626' : '#4f46e5' }}
                            >
                                {alert.actionLabel || 'Resolver'}
                            </button>
                        )}
                    </div>
                );
            })()}

            {/* 2. Mural / Highlights Carousel (Moved Up) */}
            {
                data.smartBanners.filter(b => b.type === 'mural-highlight' || b.type === 'event-today').length > 0 && (
                    <div className="mt-2 mb-2">
                        <div className="flex gap-4 overflow-x-auto pb-4 px-4 snap-x snap-mandatory scrollbar-hide">
                            {data.smartBanners
                                .filter(b => b.type === 'mural-highlight' || b.type === 'event-today')
                                .map((banner, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => banner.actionLink && navigate(banner.actionLink)}
                                        className="snap-center shrink-0 w-[85vw] max-w-[340px] h-[160px] rounded-2xl relative overflow-hidden bg-gray-900 shadow-md group cursor-pointer border border-gray-100/10 transition-transform active:scale-[0.98]"
                                    >
                                        <img
                                            src={banner.imageUrl || 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?q=80&w=1000&auto=format&fit=crop'}
                                            alt={banner.title}
                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
                                        />

                                        {/* Cinematic Gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

                                        {/* Content */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`
                                            text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg backdrop-blur-xl border border-white/10 shadow-sm
                                            ${banner.type === 'event-today' ? 'bg-purple-500/90 text-white' : 'bg-brand-500/90 text-white'}
                                        `}>
                                                    {banner.type === 'event-today' ? 'HOJE' : 'DESTAQUE'}
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-bold text-white leading-tight mb-1 drop-shadow-sm">{banner.title}</h4>
                                            <p className="text-sm font-medium text-gray-200 line-clamp-1 opacity-90">{banner.message}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )
            }


            {/* 3. Daily Highlight or Timeline (Moved Down) */}
            {/* 3. Daily Highlight or Timeline (Moved Down) */}
            <div className="flex flex-col gap-2">
                {/* Timeline Widget (Configurable) */}
                {selectedStudent && (
                    <>
                        {(timelineMode === 'graph' || timelineMode === 'both') && (
                            <DailyTimelineComponent enrollmentId={selectedStudent.enrollment_id} />
                        )}
                        {(timelineMode === 'card' || timelineMode === 'both') && (
                            <DailyTimelineVertical enrollmentId={selectedStudent.enrollment_id} />
                        )}
                    </>
                )}

                {/* Diary Widget */}
                <div className="animate-fade-in">
                    {(() => {
                        const now = new Date();
                        const hour = now.getHours();
                        // Diary Lock: Hidden before 19:00 (user requirement)
                        // But show if there IS data already (maybe manual override? No, strict rule from user)
                        // User Rule: "Aguardando Divulgação" before 19h.
                        // However, we only show it if it's a weekday? Or always? Assuming always for consistency.
                        const isDiaryLocked = hour < 19;

                        if (isDiaryLocked) {
                            return null;
                        }

                        // Unlocked: Show Data
                        if (data.dailyHighlights.hasData) {
                            return (
                                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                            <Baby className="w-4 h-4 text-brand-500" />
                                            Resumo do Dia
                                        </h3>
                                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">Atualizado</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div className="bg-orange-50 p-2 rounded-xl">
                                            <Utensils className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                                            <span className="text-xs font-medium text-gray-600">{data.dailyHighlights.food}</span>
                                        </div>
                                        <div className="bg-indigo-50 p-2 rounded-xl">
                                            <Moon className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                                            <span className="text-xs font-medium text-gray-600">{data.dailyHighlights.sleep}</span>
                                        </div>
                                        <div className="bg-yellow-50 p-2 rounded-xl">
                                            <Smile className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                                            <span className="text-xs font-medium text-gray-600">{data.dailyHighlights.mood}</span>
                                        </div>
                                        <div className="bg-blue-50 p-2 rounded-xl">
                                            <CheckCircle2 className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                                            <span className="text-xs font-medium text-gray-600">{data.dailyHighlights.bathroom}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Unlocked but Empty
                        return (
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 border-dashed text-center">
                                <p className="text-sm text-gray-500">O diário de hoje ainda não foi preenchido.</p>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* 3.5 Aulas de Hoje (ou Próximo Dia Letivo) Widget - Compacto e Clean */}


            {/* 4. Navigation Grid */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Cronograma', icon: Clock, link: '/pais/cronograma' },
                    { label: 'Mensagens', icon: MessageCircle, link: null, disabled: true }, // No link yet
                    { label: 'Financeiro', icon: CreditCard, link: '/pais/financeiro' },
                    { label: 'Mais', icon: MoreHorizontal, link: '/pais/menu' },
                ].map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => item.link && navigate(item.link)}
                        disabled={item.disabled}
                        className={`flex flex-col items-center gap-2 group ${item.disabled ? 'opacity-50 grayscale' : ''}`}
                    >
                        <div className={`
                            w-16 h-16 rounded-2xl bg-brand-50 text-brand-600
                            flex items-center justify-center shadow-sm border border-black/5
                            ${!item.disabled && 'group-active:scale-95'} transition-transform
                        `}>
                            <item.icon className="w-7 h-7" />
                        </div>
                        <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">{item.label}</span>
                    </button>
                ))}
            </div>

            {/* 5. Mural / Timeline Unified */}
            <div className="pt-2">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-lg font-bold text-gray-900">Mural & Agenda</h3>
                    {data.feed.length > 0 && (
                        <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-full">
                            {data.feed.length} atualizações
                        </span>
                    )}
                </div>

                <div className="space-y-3">
                    {data.feed.map(item => (
                        <div key={item.id} className={`
                            relative bg-white p-3 rounded-xl border shadow-sm transition-all active:scale-[0.99]
                            ${item.is_pinned ? 'bg-brand-50/30 border-brand-100' : 'border-gray-100'}
                        `}>
                            {item.is_pinned && (
                                <div className="absolute -top-1 -right-1 bg-brand-500 text-white p-0.5 rounded-full shadow-sm z-10">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 3H16.1L18.1 5L18 5L16 3ZM5 21V19H7.09L15.09 11H12.5V8.41L5 15.91V21H5Z" /></svg>
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                {/* Date Box (Compact with Color) */}
                                <div className={`
                                    w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 border mt-0.5
                                    ${item.type === 'notice' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                        item.type === 'alert' ? 'bg-red-50 border-red-100 text-red-600' :
                                            'bg-brand-50 border-brand-100 text-brand-600'}
                                `}>
                                    <span className="text-[9px] uppercase font-bold leading-none mb-0.5">{format(item.date, 'MMM', { locale: ptBR })}</span>
                                    <span className="text-sm font-bold leading-none">{format(item.date, 'dd')}</span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    {/* Badges Row */}
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                        {item.isClassSpecific && (
                                            <span className="text-[8px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 uppercase tracking-wide">
                                                Turma
                                            </span>
                                        )}
                                        {item.today && (
                                            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wide">
                                                Hoje
                                            </span>
                                        )}
                                        {item.type === 'alert' && (
                                            <span className="text-[8px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-wide">
                                                Importante
                                            </span>
                                        )}
                                        {item.type === 'event' && (item as any).eventType && (
                                            <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                                                {(item as any).eventType === 'academic' ? 'Acadêmico' :
                                                    (item as any).eventType === 'holiday' ? 'Feriado' :
                                                        (item as any).eventType === 'meeting' ? 'Reunião' : 'Geral'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-start mb-0.5">
                                        <h4 className={`text-xs font-bold leading-snug truncate ${item.is_pinned ? 'text-brand-900' : 'text-gray-900'}`}>
                                            {item.title}
                                        </h4>
                                        <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">
                                            {item.type === 'event' ? format(item.date, 'HH:mm') : ''}
                                        </span>
                                    </div>

                                    <p className="text-[11px] text-gray-500 line-clamp-1 leading-snug">
                                        {item.description}
                                    </p>
                                    {item.location && (
                                        <div className="mt-1 flex items-center gap-1 text-[9px] text-gray-400">
                                            <div className="w-1 h-1 rounded-full bg-gray-300" />
                                            {item.location}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {data.feed.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <Baby className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium text-sm">Nenhum aviso ou evento próximo.</p>
                            <button onClick={() => navigate('/pais/agenda')} className="text-xs text-brand-600 font-bold hover:underline mt-2">
                                Ver calendário completo
                            </button>
                        </div>
                    )}
                </div>



            </div>
        </div >
    );
};
