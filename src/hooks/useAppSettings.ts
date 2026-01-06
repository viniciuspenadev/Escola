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

    return { value, loading };
};
