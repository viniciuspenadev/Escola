import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../services/supabase';

export interface SchoolYear {
    id: string;
    year: string;
    status: 'active' | 'planning' | 'closed';
    is_current: boolean;
}

interface SystemContextType {
    availableYears: string[];
    years: SchoolYear[];
    currentYear: SchoolYear | null;
    planningYear: SchoolYear | null;
    isLoading: boolean;
    refreshSystem: () => Promise<void>;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export const SystemProvider = ({ children }: { children: ReactNode }) => {
    const [years, setYears] = useState<SchoolYear[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshSystem = async () => {
        try {
            const { data, error } = await supabase
                .from('school_years')
                .select('*')
                .order('year', { ascending: false });

            if (error) {
                // Determine if error is "relation does not exist" (table missing)
                if (error.code === '42P01') {
                    console.warn('Tabela school_years não existe ainda. Usando modo fallback.');
                    throw error;
                }
                console.error('Erro ao buscar anos letivos:', error);
                throw error;
            }

            setYears(data || []);
        } catch (error) {
            // Fallback safe mode - Keeps system working even before DB migration
            console.warn('[SystemContext] Using default fallback values - school year config not found');
            setYears([
                { id: 'fb-2026', year: '2026', status: 'planning', is_current: false } as SchoolYear,
                { id: 'fb-2025', year: '2025', status: 'active', is_current: true } as SchoolYear,
                { id: 'fb-2024', year: '2024', status: 'closed', is_current: false } as SchoolYear
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshSystem();
    }, []);

    const currentYear = years.find(y => y.is_current) || years.find(y => y.year === '2025') || null;
    const planningYear = years.find(y => y.status === 'planning') || null;
    const availableYears = years.map(y => y.year);

    return (
        <SystemContext.Provider value={{ availableYears, years, currentYear, planningYear, isLoading, refreshSystem }}>
            {children}
        </SystemContext.Provider>
    );
};

export const useSystem = () => {
    const context = useContext(SystemContext);
    if (!context) {
        throw new Error('useSystem must be used within a SystemProvider');
    }
    return context;
};
