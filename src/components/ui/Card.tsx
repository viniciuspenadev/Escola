
import { type ReactNode, type FC, type HTMLAttributes } from 'react';
import { cn } from './Button';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    className?: string;
    title?: string;
    description?: string;
}

export const Card: FC<CardProps> = ({ children, className, title, description, ...props }) => {
    return (
        <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden", className)} {...props}>
            {(title || description) && (
                <div className="px-6 py-4 border-b border-slate-50">
                    {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
                    {description && <p className="text-sm text-slate-500">{description}</p>}
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};
