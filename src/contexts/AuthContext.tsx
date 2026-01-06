import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string) => Promise<void>; // Simple placeholder for now
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) updateUser(session);
            setLoading(false);
        });

        // Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                updateUser(session);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const updateUser = async (session: any) => {
        // Fetch role from public.profiles (source of truth)
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, name')
            .eq('id', session.user.id)
            .single();

        setUser({
            id: session.user.id,
            email: session.user.email!,
            name: profile?.name || session.user.user_metadata?.name || 'Usuário',
            role: (profile?.role as any) || 'PARENT'
        });
    };

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) console.error('Error signing out:', error);
        } catch (error) {
            console.error('Unexpected error signing out:', error);
        } finally {
            // Force clean state
            setUser(null);

            // Clear Supabase local storage keys manually to prevent persistence
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) {
                    localStorage.removeItem(key);
                }
            });
        }
    };

    const signIn = async (_email: string) => {
        // Placeholder: Actual login is handled by Login.tsx calling supabase directly
        // This context just reacts to the session change.
        // Sign in initiated - no logging of credentials
    }

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
