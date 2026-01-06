import { type FC, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { hasRouteAccess, getDefaultRoute } from '../utils/rolePermissions';
import type { User } from '../types';

interface ProtectedRouteProps {
    children: ReactNode;
    user: User;
    onLogout: () => void;
}

/**
 * ProtectedRoute component
 * Checks if user has access to the current route based on their role
 * If not authorized, redirects to appropriate default route
 */
export const ProtectedRoute: FC<ProtectedRouteProps> = ({
    children,
    user,
    onLogout
}) => {
    const location = useLocation();
    const currentPath = location.pathname;

    // Check if user has access to this route
    const hasAccess = hasRouteAccess(user.role, currentPath);

    // If user doesn't have access, redirect to their default route
    if (!hasAccess) {
        const defaultRoute = getDefaultRoute(user.role);
        return <Navigate to={defaultRoute} replace />;
    }

    // User has access, render with layout
    return (
        <AdminLayout user={user} onLogout={onLogout}>
            {children}
        </AdminLayout>
    );
};
