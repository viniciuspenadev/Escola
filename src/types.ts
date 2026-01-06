
export type UserRole = 'ADMIN' | 'SECRETARY' | 'COORDINATOR' | 'TEACHER' | 'PARENT';

export const UserRole = {
    ADMIN: 'ADMIN' as UserRole,
    SECRETARY: 'SECRETARY' as UserRole,
    COORDINATOR: 'COORDINATOR' as UserRole,
    TEACHER: 'TEACHER' as UserRole,
    PARENT: 'PARENT' as UserRole
};

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatar_url?: string;
}

export interface Student {
    id: string;
    name: string;
    birth_date: string;
    photo_url?: string;
}

export interface Class {
    id: string;
    name: string;
    school_year: number;
    shift: 'morning' | 'afternoon' | 'full' | 'night';
    capacity: number;
    status: 'active' | 'archived';
    created_at?: string;
    _count?: {
        enrollments: number;
    };
}

export interface ClassEnrollment {
    id: string;
    class_id: string;
    student_id: string;
    enrollment_id: string;
    created_at: string;
    student?: Student;
}

export interface ClassSchedule {
    id: string;
    class_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    subject: string;
    teacher_id?: string;
    teacher?: {
        name: string;
    };
}

export interface Subject {
    id: string;
    name: string;
    emoji: string;
    color: string;
    description?: string;
}

export interface LessonPlan {
    id: string;
    class_id: string;
    teacher_id?: string;
    subject_id: string;
    subject?: Subject;

    date: string;
    start_time: string;
    end_time: string;

    topic?: string;
    objective?: string;
    materials?: string;
    notes?: string;
    homework?: string;

    status: 'planned' | 'completed' | 'cancelled' | 'rescheduled';
    is_modified: boolean;
}

export interface LessonPlanChange {
    id: string;
    lesson_plan_id: string;
    change_type: 'created' | 'updated' | 'cancelled';
    field_changed?: string;
    old_value?: string;
    new_value?: string;
    reason?: string;
    changed_by: string;
    changed_at: string;
    parents_notified: boolean;
}

export interface Event {
    id?: string;
    title: string;
    description?: string;
    start_time: string;
    end_time?: string;
    type: 'academic' | 'holiday' | 'meeting' | 'generic';
    category?: 'event' | 'notice' | 'alert' | 'mural';
    is_pinned?: boolean;
    class_id?: string | null;
    image_url?: string;
    show_on_mural?: boolean;
    created_at?: string;
    created_by?: string;
}
