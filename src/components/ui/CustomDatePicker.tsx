import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CustomDatePickerProps {
    value: string;
    onChange: (date: string) => void;
    minDate?: string;
    maxDate?: string;
    highlightedDates?: string[]; // Dates (YYYY-MM-DD) to show a dot
    className?: string;
}

export const CustomDatePicker = ({
    value,
    onChange,
    minDate,
    maxDate,
    highlightedDates = [],
    className = ''
}: CustomDatePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Helper to parse "YYYY-MM-DD" safely (local time)
    const parseDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // State for the currently viewed month in the calendar
    const [viewDate, setViewDate] = useState(() => parseDate(value));

    // Sync view with value change (if closed)
    useEffect(() => {
        if (!isOpen) {
            setViewDate(parseDate(value));
        }
    }, [value, isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);

        // Simple constraint check (optional, can be stricter)
        if (minDate && delta < 0) {
            const min = parseDate(minDate);
            if (newDate.getFullYear() < min.getFullYear() || (newDate.getFullYear() === min.getFullYear() && newDate.getMonth() < min.getMonth())) {
                return; // Prevent going before min month
            }
        }
        if (maxDate && delta > 0) {
            const max = parseDate(maxDate);
            if (newDate.getFullYear() > max.getFullYear() || (newDate.getFullYear() === max.getFullYear() && newDate.getMonth() > max.getMonth())) {
                return;
            }
        }

        setViewDate(newDate);
    };

    // Generate days for grid
    const getDaysInMonth = (year: number, month: number) => {
        const date = new Date(year, month, 1);
        const days = [];

        // Fill previous month days
        const firstDayOfWeek = date.getDay(); // 0 = Sunday
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null);
        }

        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const days = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const monthName = viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white/20 backdrop-blur-md rounded-xl flex items-center border border-white/20 shadow-sm hover:bg-white/30 transition-all cursor-pointer overflow-hidden relative group"
            >
                <div className="pl-3 flex items-center pointer-events-none z-10">
                    <CalendarIcon className="w-4 h-4 text-white/80" />
                </div>
                <span className="pl-2 pr-4 py-2 text-sm font-bold text-white uppercase tracking-wider select-none min-w-[100px] text-center">
                    {parseDate(value).toLocaleDateString('pt-BR')}
                </span>
            </div>

            {/* Dropdown Calendar */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50 w-72 animate-scale-in origin-top-left">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-gray-800 capitalize">{monthName}</span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {weekDays.map((d, i) => (
                            <span key={`${d}-${i}`} className="text-xs font-bold text-gray-400">{d}</span>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, i) => {
                            if (!day) return <div key={`empty-${i}`} />;

                            const dayStr = formatDate(day);
                            const isSelected = dayStr === value;
                            const isToday = dayStr === formatDate(new Date());
                            const hasEvent = highlightedDates.includes(dayStr);

                            // Check max/min bounds
                            let isDisabled = false;
                            if (minDate && dayStr < minDate) isDisabled = true;
                            if (maxDate && dayStr > maxDate) isDisabled = true;

                            return (
                                <button
                                    key={dayStr}
                                    disabled={isDisabled}
                                    onClick={() => {
                                        onChange(dayStr);
                                        setIsOpen(false);
                                    }}
                                    className={`
                                        h-8 w-8 rounded-lg flex items-center justify-center text-sm font-medium relative transition-colors
                                        ${isSelected ? 'bg-brand-600 text-white shadow-md' : 'text-gray-700 hover:bg-brand-50'}
                                        ${isToday && !isSelected ? 'text-brand-600 font-bold border border-brand-200' : ''}
                                        ${isDisabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}
                                    `}
                                >
                                    {day.getDate()}
                                    {hasEvent && !isSelected && (
                                        <span className="absolute bottom-1 w-1 h-1 bg-brand-400 rounded-full" />
                                    )}
                                    {hasEvent && isSelected && (
                                        <span className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                        <span className="text-xs text-gray-500 font-medium">Dias com aula</span>
                    </div>
                </div>
            )}
        </div>
    );
};
