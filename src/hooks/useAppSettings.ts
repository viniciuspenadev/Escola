import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export const useAppSettings = (key: string, defaultValue: string = '') => {
    const [value, setValue] = useState(defaultValue);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSetting = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', key)
                    .single();

                if (data) {
                    setValue(data.value);
                }
            } catch (err) {
                console.error(`Error fetching setting ${key}:`, err);
            } finally {
                setLoading(false);
            }
        };

        fetchSetting();
    }, [key]);

    const updateSetting = async (newValue: string) => {
        try {
            // Check if exists first
            const { data: existing } = await supabase
                .from('app_settings')
                .select('key')
                .eq('key', key)
                .single();

            if (existing) {
                await supabase
                    .from('app_settings')
                    .update({ value: newValue, updated_at: new Date().toISOString() })
                    .eq('key', key);
            } else {
                await supabase
                    .from('app_settings')
                    .insert([{ key, value: newValue, description: 'Created via App' }]);
            }
            setValue(newValue);
            return true;
        } catch (err) {
            console.error(`Error updating setting ${key}:`, err);
            return false;
        }
    };

    return { value, loading, updateSetting };
};
