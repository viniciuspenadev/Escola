import { type FC } from 'react';
import { useDailyTimeline } from '../../hooks/useDailyTimeline';
import { Clock, CheckCircle2, Circle } from 'lucide-react';

interface DailyTimelineProps {
    classId?: string;
    enrollmentId?: string;
}

export const DailyTimelineVertical: FC<DailyTimelineProps> = ({ classId, enrollmentId }) => {
    const { timeline, loading } = useDailyTimeline({ classId, enrollmentId });

    if (loading) return null;
    if (!timeline || !timeline.items || timeline.items.length === 0) return null;

    // Helper to get time in minutes
    const getTimeInMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Logic to find the "Active" or "Next" item
    const getActiveItem = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // 1. Try to find currently running item
        for (let i = 0; i < timeline.items!.length; i++) {
            const item = timeline.items![i];
            const nextItem = i < timeline.items!.length - 1 ? timeline.items![i + 1] : null;

            if (!item.start_time) continue;
            const start = getTimeInMinutes(item.start_time);

            if (nextItem && nextItem.start_time) {
                const end = getTimeInMinutes(nextItem.start_time);
                if (currentMinutes >= start && currentMinutes < end) return { item, status: 'current' };
            } else {
                // Last item
                if (currentMinutes >= start) return { item, status: 'current' };
            }
        }

        // 2. If no current, find next upcoming
        const upcoming = timeline.items!.find(i => i.start_time && getTimeInMinutes(i.start_time) > currentMinutes);
        if (upcoming) return { item: upcoming, status: 'next' };

        // 3. If all passed, show the last one (completed)
        return { item: timeline.items![timeline.items!.length - 1], status: 'completed' };
    };

    const activeData = getActiveItem();
    if (!activeData) return null;

    const { item, status } = activeData;

    // Calculate progress percentage for current item
    const getProgress = () => {
        if (!item.start_time) return 0;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const start = getTimeInMinutes(item.start_time);

        // Find next item time or assume 1 hour duration if last
        let end = start + 60;

        // Try to find actual next item
        const currentIndex = timeline.items!.findIndex(i => i.id === item.id);
        if (currentIndex !== -1 && currentIndex < timeline.items!.length - 1) {
            const next = timeline.items![currentIndex + 1];
            if (next.start_time) {
                end = getTimeInMinutes(next.start_time);
            }
        }

        const totalDuration = end - start;
        const elapsed = currentMinutes - start;
        const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        return percent;
    };

    const progress = status === 'current' ? getProgress() : 0;

    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-fade-in my-2">
            <div className="flex items-center gap-4">
                {/* Status Indicator / Icon with Pulse */}
                <div className="relative shrink-0">
                    {status === 'current' && (
                        <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                    )}
                    <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center relative z-10 transition-colors
                        ${status === 'current' ? 'bg-gradient-to-tr from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 ring-2 ring-white ring-offset-2 ring-offset-blue-50' : ''}
                        ${status === 'next' ? 'bg-indigo-50 text-indigo-500 border-2 border-indigo-100' : ''}
                        ${status === 'completed' ? 'bg-gray-50 text-gray-400 border border-gray-100' : ''}
                    `}>
                        {status === 'current' ? <Clock className="w-6 h-6 animate-pulse" /> :
                            status === 'next' ? <Circle className="w-6 h-6" /> :
                                <CheckCircle2 className="w-6 h-6" />}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className={`
                            text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide
                            ${status === 'current' ? 'bg-blue-100 text-blue-700' : ''}
                            ${status === 'next' ? 'bg-indigo-50 text-indigo-600' : ''}
                            ${status === 'completed' ? 'bg-gray-100 text-gray-500' : ''}
                        `}>
                            {status === 'current' ? 'Agora' :
                                status === 'next' ? 'A Seguir' : 'Finalizado'}
                        </span>
                        <span className="text-xs font-bold text-gray-400 font-mono">
                            {item.start_time ? item.start_time.slice(0, 5) : '--:--'}
                        </span>
                    </div>

                    <h3 className="text-base font-bold text-gray-800 line-clamp-1 leading-tight mb-1">
                        {item.title}
                    </h3>

                    {/* Description or Progress Bar */}
                    {status === 'current' ? (
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div
                                className="bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500 line-clamp-1">
                            {item.description || (status === 'next' ? 'Prepare-se para esta atividade' : 'Concluído')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
