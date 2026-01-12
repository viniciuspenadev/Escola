import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, Calendar, CreditCard, Megaphone, Bus, DoorOpen, ArrowLeft } from 'lucide-react';
import { useNotifications, type Notification } from '../../contexts/NotificationContext';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';

export const ParentNotificationsPage: FC = () => {
    const { notifications, markAsRead, markAllAsRead } = useNotifications();
    const navigate = useNavigate();

    // Mark all as read when entering the page? 
    // User requested "Mark as read behavior on page view" in task, but maybe "click to mark" is safer?
    // The plan said: "O clique na notificação navega ... e marca como lida."
    // Let's keep manual interaction for specific items, but maybe a "Mark All" button at top.

    // Grouping Logic
    const groupedNotifications = {
        today: notifications.filter(n => isToday(new Date(n.created_at))),
        yesterday: notifications.filter(n => isYesterday(new Date(n.created_at))),
        week: notifications.filter(n => !isToday(new Date(n.created_at)) && !isYesterday(new Date(n.created_at)) && isThisWeek(new Date(n.created_at))),
        older: notifications.filter(n => !isThisWeek(new Date(n.created_at))),
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Navigation Logic
        switch (notification.type) {
            case 'diary': navigate('/pais/diario'); break;
            case 'finance': navigate('/pais/financeiro'); break;
            case 'event': navigate('/pais/agenda'); break;
            case 'notice':
            case 'gate':
            case 'bus':
                navigate('/pais/home');
                break;
            default: break;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'diary': return { icon: <BookOpen className="w-6 h-6 text-brand-600" />, bg: "bg-brand-100", border: "border-brand-200" };
            case 'finance': return { icon: <CreditCard className="w-6 h-6 text-red-600" />, bg: "bg-red-100", border: "border-red-200" };
            case 'event': return { icon: <Calendar className="w-6 h-6 text-indigo-600" />, bg: "bg-indigo-100", border: "border-indigo-200" };
            case 'gate': return { icon: <DoorOpen className="w-6 h-6 text-emerald-600" />, bg: "bg-emerald-100", border: "border-emerald-200" };
            case 'bus': return { icon: <Bus className="w-6 h-6 text-amber-600" />, bg: "bg-amber-100", border: "border-amber-200" };
            case 'notice': return { icon: <Megaphone className="w-6 h-6 text-orange-600" />, bg: "bg-orange-100", border: "border-orange-200" };
            default: return { icon: <Bell className="w-6 h-6 text-gray-600" />, bg: "bg-gray-100", border: "border-gray-200" };
        }
    };

    return (
        <div className="min-h-screen bg-white pb-20 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-100 px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-700" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Notificações</h1>
                </div>
                {notifications.some(n => !n.read) && (
                    <button
                        onClick={() => markAllAsRead()}
                        className="text-brand-600 font-medium text-sm hover:bg-brand-50 px-3 py-1.5 rounded-full transition-colors"
                    >
                        Marcar todas como lidas
                    </button>
                )}
            </div>

            {/* List */}
            <div className="p-4 space-y-6">
                {notifications.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Bell className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Nenhuma notificação</h3>
                        <p className="text-gray-500 max-w-xs mx-auto mt-2">
                            Você está em dia! Avisaremos aqui quando houver novidades sobre a rotina escolar.
                        </p>
                    </div>
                )}

                {Object.entries(groupedNotifications).map(([key, items]) => {
                    if (items.length === 0) return null;

                    const title = {
                        today: 'Hoje',
                        yesterday: 'Ontem',
                        week: 'Esta Semana',
                        older: 'Antigas'
                    }[key];

                    return (
                        <div key={key} className="space-y-4">
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-2 sticky top-[70px] bg-white/95 backdrop-blur z-0 py-2">
                                {title}
                            </h2>
                            <div className="space-y-1">
                                {items.map((notification) => {
                                    const style = getIcon(notification.type);
                                    return (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`w-full text-left p-3 rounded-2xl flex items-start gap-4 transition-all active:scale-[0.98]
                                                ${!notification.read ? 'bg-brand-50/40' : 'hover:bg-gray-50'}
                                            `}
                                        >
                                            <div className={`
                                                w-12 h-12 rounded-full flex items-center justify-center shrink-0 border shadow-sm mt-0.5
                                                ${style.bg} ${style.border}
                                            `}>
                                                {style.icon}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className="text-sm text-gray-900 leading-snug">
                                                        <span className="font-bold mr-1">{notification.title}</span>
                                                        <span className="text-gray-600 font-normal">{notification.message}</span>
                                                    </p>
                                                    {!notification.read && (
                                                        <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-400 mt-1 block">
                                                    {format(new Date(notification.created_at), "HH:mm")}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
