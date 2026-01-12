-- View for Student Management Overview
-- Combines: Student Info, Current Class, Financial Status (Overdue), and Attendance

DROP VIEW IF EXISTS student_management_overview;

CREATE OR REPLACE VIEW student_management_overview AS
WITH current_classes AS (
    SELECT 
        ce.student_id,
        c.name as class_name,
        c.id as class_id
    FROM class_enrollments ce
    JOIN classes c ON ce.class_id = c.id
    -- Assuming one active enrollment per student for simplicity or taking the latest
    ORDER BY ce.created_at DESC
),
attendance_stats AS (
    SELECT
        student_id,
        COUNT(*) as total_days,
        COUNT(*) FILTER (WHERE status = 'present') as present_days,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_days
    FROM student_attendance
    GROUP BY student_id
),
financial_stats AS (
    SELECT
        s.id as student_id,
        COUNT(i.id) FILTER (WHERE i.status = 'overdue') as overdue_count,
        COUNT(i.id) FILTER (WHERE i.status = 'pending') as pending_count
    FROM students s
    LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'approved'
    LEFT JOIN installments i ON i.enrollment_id = e.id
    GROUP BY s.id
)

SELECT 
    s.id,
    s.name,
    s.status,
    s.responsibles_contact, -- Assuming this JSON exists or we use Enrollment parent email
    cc.class_name,
    cc.class_id,
    
    -- Attendance
    COALESCE(ast.total_days, 0) as att_total,
    COALESCE(ast.present_days, 0) as att_present,
    CASE 
        WHEN COALESCE(ast.total_days, 0) = 0 THEN 0
        ELSE ROUND((ast.present_days::numeric / ast.total_days::numeric) * 100, 1)
    END as attendance_rate,

    -- Financial
    COALESCE(fs.overdue_count, 0) as overdue_count,
    CASE
        WHEN COALESCE(fs.overdue_count, 0) > 0 THEN 'overdue'
        WHEN COALESCE(fs.pending_count, 0) > 0 THEN 'pending'
        ELSE 'paid' -- Simplified state
    END as financial_status

FROM students s
LEFT JOIN current_classes cc ON cc.student_id = s.id
LEFT JOIN attendance_stats ast ON ast.student_id = s.id
LEFT JOIN financial_stats fs ON fs.student_id = s.id;
