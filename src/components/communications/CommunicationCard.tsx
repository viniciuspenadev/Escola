import React from 'react';
import type { CommunicationRecipient } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Icons from 'lucide-react';
import { Mail, MailOpen } from 'lucide-react';

interface CommunicationCardProps {
    recipient: CommunicationRecipient;
    onClick: () => void;
}

const CommunicationCard: React.FC<CommunicationCardProps> = ({ recipient, onClick }) => {
    const { communication } = recipient;
    if (!communication || !communication.channel) return null;

    const { channel, title, preview_text, created_at, priority } = communication;
    const isUnread = !recipient.read_at;

    // Dynamic Icon
    // @ts-ignore
    const IconComponent = Icons[channel.icon_name.charAt(0).toUpperCase() + channel.icon_name.slice(1)] || Icons.MessageSquare;

    const getBadgeColor = (color: string) => {
        switch (color) {
            case 'red': return 'bg-red-100 text-red-700 border-red-200';
            case 'green': return 'bg-green-100 text-green-700 border-green-200';
            case 'blue': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'purple': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'orange': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'pink': return 'bg-pink-100 text-pink-700 border-pink-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div
            onClick={onClick}
            className={`group relative p-4 rounded-xl border mb-3 cursor-pointer transition-all hover:bg-gray-50 active:scale-[0.99]
                ${isUnread
                    ? 'bg-white border-l-4 border-l-blue-500 shadow-sm border-t-gray-100 border-r-gray-100 border-b-gray-100'
                    : 'bg-white border-transparent border-b-gray-100 opacity-90'
                }
            `}
            style={{ borderLeftColor: isUnread ? undefined : 'transparent' }} // Reset border-l for read items
        >
            <div className="flex gap-4 items-start">
                {/* Channel Icon Only */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm mt-0.5
                    ${isUnread
                        ? `bg-${channel.color}-100 text-${channel.color}-600`
                        : 'bg-gray-100 text-gray-400 grayscale'
                    }
                `}>
                    <IconComponent size={24} strokeWidth={isUnread ? 2.5 : 2} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col h-full relative">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            {/* Badge referenced by user - made smaller */}
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded border ${getBadgeColor(channel.color)}`}>
                                {channel.name}
                            </span>
                            {communication.sender_profile?.name && (
                                <span className="text-xs text-gray-400 truncate max-w-[120px]">
                                    {communication.sender_profile.name}
                                </span>
                            )}
                        </div>
                        <span className={`text-[10px] whitespace-nowrap ml-2 ${isUnread ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                            {format(new Date(created_at), "dd MMM", { locale: ptBR })}
                        </span>
                    </div>

                    <div className="pr-6"> {/* Padding right to avoid overlap with bottom-right icon if needed, though icon is below */}
                        <h3 className={`text-[15px] leading-snug mb-1 truncate pr-2 ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                            {title}
                        </h3>

                        <p className={`text-sm line-clamp-2 ${isUnread ? 'text-gray-600' : 'text-gray-400'}`}>
                            {preview_text || 'Toque para ler o comunicado completo...'}
                        </p>
                    </div>

                    {/* Footer Row: Priority/Template Badges + Mail Icon at absolute bottom right */}
                    <div className="flex items-center justify-between mt-3 min-h-[20px]">
                        <div className="flex items-center gap-2">
                            {priority === 2 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-600 flex items-center gap-1">
                                    <Icons.AlertCircle size={10} />
                                    Urgente
                                </span>
                            )}
                            {communication.metadata?.template && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    {communication.metadata.template === 'rsvp' ? <Icons.CalendarCheck size={10} /> : <Icons.BarChart2 size={10} />}
                                    {communication.metadata.template}
                                </span>
                            )}
                        </div>

                        {/* Mail Icon - No background, small, bottom right, lighter (no fill) */}
                        <div className={`transition-transform duration-300 ${isUnread ? 'text-blue-600 scale-105' : 'text-gray-300'}`}>
                            {isUnread ? <Mail size={16} strokeWidth={2.5} /> : <MailOpen size={16} strokeWidth={1.5} />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunicationCard;
