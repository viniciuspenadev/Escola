import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

// Planning configuration stored in database
export interface PlanningConfig {
    id: string;
    deadline_day: number;        // 0=Sun, 4=Thu
    deadline_time: string;        // "23:59"
    workdays: boolean[];          // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    alert_level: 'strict' | 'moderate' | 'disabled';
    grace_period_days: number;    // 0-7
}

const DEFAULT_CONFIG: PlanningConfig = {
    id: '00000000-0000-0000-0000-000000000001',
    deadline_day: 4,
    deadline_time: '23:59',
    workdays: [true, true, true, true, true, false, false],
    alert_level: 'strict',
    grace_period_days: 0
};

export const usePlanningSettings = () => {
    const [config, setConfig] = useState<PlanningConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    // Fetch configuration from database
    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('planning_config')
                .select('*')
                .single();

            if (error) throw error;
            if (data) setConfig(data);
        } catch (error) {
            console.error('Failed to fetch planning config:', error);
            // Fallback to default
            setConfig(DEFAULT_CONFIG);
        } finally {
            setLoading(false);
        }
    };

    // Subscribe to realtime changes
    useEffect(() => {
        fetchConfig();

        const subscription = supabase
            .channel('planning_config_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'planning_config'
                },
                (payload: any) => {
                    setConfig(payload.new as PlanningConfig);
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Save configuration (admin only)
    const saveConfig = async (newConfig: Partial<PlanningConfig>) => {
        try {
            const { error } = await supabase
                .from('planning_config')
                .update(newConfig)
                .eq('id', config.id);

            if (error) throw error;

            // Refetch to get updated data
            await fetchConfig();
            return { success: true };
        } catch (error) {
            console.error('Failed to save planning config:', error);
            return { success: false, error };
        }
    };

    return { config, loading, saveConfig };
};
