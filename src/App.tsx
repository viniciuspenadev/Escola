import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './AppRouter';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StudentProvider } from './contexts/StudentContext';
import { SystemProvider } from './contexts/SystemContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { Loader2 } from 'lucide-react';
import type { User } from './types';

function AppContent() {
  const { user, loading, signOut } = useAuth();

  // Handle Demo Login Prop (Legacy support for Login.tsx which calls onLogin)
  // In a real app, Login.tsx should call supabase.auth.signInWith... and the Context picks it up.
  // We'll keep the prop signature for AppRouter compatibility for now.
  const handleLogin = (_user: User) => { /* No-op, context handles it */ };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <SystemProvider>
          <StudentProvider>
            <NotificationProvider>
              <AppRouter user={user} onLogin={handleLogin} onLogout={signOut} />
            </NotificationProvider>
          </StudentProvider>
        </SystemProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
