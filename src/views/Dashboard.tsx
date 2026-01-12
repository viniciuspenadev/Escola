import { type FC } from 'react';
import { EnrollmentFunnel } from '../components/dashboard/EnrollmentFunnel';
import { TaskWidget } from '../components/dashboard/TaskWidget';
import { NextEvents } from '../components/dashboard/NextEvents';
import { AttendanceChart } from '../components/dashboard/AttendanceChart';
import { StudentMoodChart } from '../components/dashboard/StudentMoodChart';
import { UpcomingVisitsWidget } from '../components/dashboard/UpcomingVisitsWidget';

export const DashboardView: FC = () => {
    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Painel de Controle</h1>
                    <p className="text-gray-500">Visão geral e operações diárias da escola.</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Analytics & Major Flows & Tasks (Span 8) */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Key Metric: Enrollment Funnel */}
                    <section className="space-y-3">
                        <EnrollmentFunnel />
                    </section>

                    {/* Pedagogical Indicators */}
                    <section className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AttendanceChart />
                            <StudentMoodChart />
                        </div>
                    </section>

                    {/* Tasks List (Now at bottom of main column) */}
                    <section className="space-y-3">
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[300px]">
                            <TaskWidget />
                        </div>
                    </section>
                </div>

                {/* Right Column: Daily Operations (Span 4) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Operational Widgets */}
                    <section className="space-y-6">

                        {/* Recent Widget: Visits */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <UpcomingVisitsWidget />
                        </div>

                        <div>
                            {/* Next Events Widget */}
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[380px] overflow-hidden">
                                <NextEvents />
                            </div>
                        </div>
                    </section>
                </div>

            </div>
        </div>
    );
};
