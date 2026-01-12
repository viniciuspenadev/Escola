import { type FC } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import { EnrollmentPage } from './views/public/EnrollmentPage';
import { Login } from './views/Login';
import { EnrollmentListView } from './views/EnrollmentList';
import { EnrollmentCreateView } from './views/EnrollmentCreate';
import { CompleteEnrollmentView } from './views/CompleteEnrollment';
import { EnrollmentDetailsView } from './views/EnrollmentDetails';
import { StudentListView } from './views/StudentList';
import { StudentProfileView } from './views/StudentProfile';
import { DashboardView } from './views/Dashboard';
import { FinancialDashboardView } from './views/FinancialDashboard';
import { FinancialPlansView } from './views/FinancialPlans';
import { FinancialReceivablesView } from './views/FinancialReceivables';
import { FinancialStudentHub } from './views/FinancialStudentHub';
import { ChargeDetailsView } from './views/ChargeDetails';
import { AccountsPayableView } from './views/AccountsPayable';
import { AttendanceManagementView } from './views/AttendanceManagement';
import { ClassListView } from './views/ClassList';
import { ClassCreateView } from './views/ClassCreate';
import { ClassDetailsView } from './views/ClassDetails';
import { AgendaView } from './views/Agenda';
import { ParentLayout } from './layouts/ParentLayout';
import { ParentDashboard } from './views/parent/ParentDashboard';
import { ParentCalendar } from './views/parent/ParentCalendar';
import { ParentDiary } from './views/parent/ParentDiary';
import { ParentFinancial } from './views/parent/ParentFinancial';
import { ParentGrades } from './views/parent/ParentGrades';
import { ParentSchedule } from './views/parent/ParentSchedule';
import { MuralDetails } from './views/parent/MuralDetails';
import { ParentNotificationsPage } from './views/parent/ParentNotificationsPage';
import { ParentMenu } from './views/parent/ParentMenu';
import CommunicationsInbox from './views/parent/CommunicationsInbox';
import CommunicationDetail from './views/parent/CommunicationDetail';
import { UserManagement } from './views/UserManagement';
import { AcademicYearsSettings } from './views/admin/AcademicYearsSettings';
import { CommunicationSettings } from './views/admin/CommunicationSettings';

import { GeneralSettings } from './views/admin/GeneralSettings';
import { TimelineSettings } from './views/admin/TimelineSettings';
import { SubjectCatalog } from './views/admin/SubjectCatalog';
import { PlanningDashboard } from './views/planning/PlanningDashboard';
import { PlanningOverviewMockup } from './views/planning/PlanningOverviewMockup';
import CommunicationsComposer from './views/admin/CommunicationsComposer';
import CommunicationsDashboard from './views/admin/CommunicationsDashboard';
import { LeadsKanban } from './views/admin/leads/LeadsKanban';

import type { User } from './types';

import { ProtectedRoute } from './components/ProtectedRoute';
import { getDefaultRoute } from './utils/rolePermissions';

interface AppRouterProps {
    user: User | null;
    onLogin: (user: User) => void;
    onLogout: () => void;
}



export const AppRouter: FC<AppRouterProps> = ({ user, onLogin, onLogout }) => {
    if (!user) {
        return (
            <Routes>
                <Route path="/" element={<Login onLogin={onLogin} onPublicEnrollment={() => { }} />} />

                {/* Public Routes */}
                <Route element={<PublicLayout />}>
                    <Route path="/matricula" element={<EnrollmentPage />} />
                </Route>

                <Route path="/completar-matricula/:token" element={<CompleteEnrollmentView />} />
                <Route path="/mockup-gestao" element={<PlanningOverviewMockup />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<Navigate to={getDefaultRoute(user.role)} replace />} />

            {/* Admin Routes (Should be protected against Parents in a real scenario, but RLS handles data) */}
            <Route path="/dashboard" element={<ProtectedRoute user={user} onLogout={onLogout}><DashboardView /></ProtectedRoute>} />

            {/* Enrollment Routes */}
            <Route path="/matriculas" element={<ProtectedRoute user={user} onLogout={onLogout}><EnrollmentListView /></ProtectedRoute>} />
            <Route path="/matriculas/nova" element={<ProtectedRoute user={user} onLogout={onLogout}><EnrollmentCreateView /></ProtectedRoute>} />
            <Route path="/matriculas/:id" element={<ProtectedRoute user={user} onLogout={onLogout}><EnrollmentDetailsView /></ProtectedRoute>} />

            {/* Student Routes */}
            <Route path="/alunos" element={<ProtectedRoute user={user} onLogout={onLogout}><StudentListView /></ProtectedRoute>} />
            <Route path="/alunos/:id" element={<ProtectedRoute user={user} onLogout={onLogout}><StudentProfileView /></ProtectedRoute>} />
            <Route path="/frequencia" element={<ProtectedRoute user={user} onLogout={onLogout}><AttendanceManagementView /></ProtectedRoute>} />

            {/* User Management */}
            <Route path="/usuarios" element={<ProtectedRoute user={user} onLogout={onLogout}><UserManagement /></ProtectedRoute>} />

            {/* Config Routes */}
            <Route path="/config/anos-letivos" element={<ProtectedRoute user={user} onLogout={onLogout}><AcademicYearsSettings /></ProtectedRoute>} />
            <Route path="/config/comunicacao" element={<ProtectedRoute user={user} onLogout={onLogout}><CommunicationSettings /></ProtectedRoute>} />
            <Route path="/config/geral" element={<ProtectedRoute user={user} onLogout={onLogout}><GeneralSettings /></ProtectedRoute>} />
            <Route path="/config/timelines" element={<ProtectedRoute user={user} onLogout={onLogout}><TimelineSettings /></ProtectedRoute>} />
            <Route path="/config/materias" element={<ProtectedRoute user={user} onLogout={onLogout}><SubjectCatalog /></ProtectedRoute>} />
            <Route path="/admin/comunicados" element={<ProtectedRoute user={user} onLogout={onLogout}><CommunicationsDashboard /></ProtectedRoute>} />
            <Route path="/admin/comunicados/novo" element={<ProtectedRoute user={user} onLogout={onLogout}><CommunicationsComposer /></ProtectedRoute>} />

            {/* CRM / Leads */}
            <Route path="/admin/leads" element={<ProtectedRoute user={user} onLogout={onLogout}><LeadsKanban /></ProtectedRoute>} />

            {/* Class Routes */}
            <Route path="/turmas" element={<ProtectedRoute user={user} onLogout={onLogout}><ClassListView /></ProtectedRoute>} />
            <Route path="/turmas/nova" element={<ProtectedRoute user={user} onLogout={onLogout}><ClassCreateView /></ProtectedRoute>} />
            <Route path="/turmas/:id" element={<ProtectedRoute user={user} onLogout={onLogout}><ClassDetailsView /></ProtectedRoute>} />

            {/* Financial Routes */}
            <Route path="/financeiro" element={<ProtectedRoute user={user} onLogout={onLogout}><FinancialDashboardView /></ProtectedRoute>} />
            <Route path="/financeiro/planos" element={<ProtectedRoute user={user} onLogout={onLogout}><FinancialPlansView /></ProtectedRoute>} />
            <Route path="/financeiro/recebiveis" element={<ProtectedRoute user={user} onLogout={onLogout}><FinancialReceivablesView /></ProtectedRoute>} />
            <Route path="/financeiro/alunos" element={<ProtectedRoute user={user} onLogout={onLogout}><FinancialStudentHub /></ProtectedRoute>} />
            <Route path="/financeiro/pagar" element={<ProtectedRoute user={user} onLogout={onLogout}><AccountsPayableView /></ProtectedRoute>} />
            <Route path="/financeiro/cobranca/:id" element={<ProtectedRoute user={user} onLogout={onLogout}><ChargeDetailsView /></ProtectedRoute>} />

            <Route path="/agenda" element={<ProtectedRoute user={user} onLogout={onLogout}><AgendaView /></ProtectedRoute>} />
            <Route path="/planejamento" element={<ProtectedRoute user={user} onLogout={onLogout}><PlanningDashboard /></ProtectedRoute>} />
            <Route path="/mockup-gestao" element={<PlanningOverviewMockup />} />

            {/* Parent Portal Routes */}
            <Route path="/pais" element={<ParentLayout />}>
                <Route path="home" element={<ParentDashboard />} />
                <Route path="agenda" element={<ParentCalendar />} />
                <Route path="diario" element={<ParentDiary />} />
                <Route path="financeiro" element={<ParentFinancial />} />
                <Route path="boletim" element={<ParentGrades />} />
                <Route path="cronograma" element={<ParentSchedule />} />
                <Route path="mural/:id" element={<MuralDetails />} />
                <Route path="comunicados" element={<CommunicationsInbox />} />
                <Route path="comunicados/novo" element={<CommunicationsComposer />} />
                <Route path="comunicados/:id" element={<CommunicationDetail />} />
                <Route path="notificacoes" element={<ParentNotificationsPage />} />
                <Route path="menu" element={<ParentMenu />} />
                <Route path="perfil" element={<div className="p-6 text-center text-gray-500">Módulo Perfil em Construção</div>} />
                {/* Default redirect for /pais */}
                <Route index element={<Navigate to="home" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
};
