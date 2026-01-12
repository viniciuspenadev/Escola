-- View for Attendance Management Dashboard
-- Aggregates attendance stats per student for the current context (or all time, filtering usually done by Year in WHERE clause if columns exist)

DROP VIEW IF EXISTS attendance_dashboard_view;

CREATE OR REPLACE VIEW attendance_dashboard_view AS
WITH current_classes AS (
    SELECT 
        ce.student_id,
        c.name as class_name,
        c.id as class_id,
        c.school_year
    FROM class_enrollments ce
    JOIN classes c ON ce.class_id = c.id
    -- Get the most recent enrollment per student
    ORDER BY ce.created_at DESC
),
attendance_aggregates AS (
    SELECT
        student_id,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE status = 'present') as present_count,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
        COUNT(*) FILTER (WHERE status = 'justified') as justified_count,
        MAX(class_attendance_sheets.date) as last_attendance_date
    FROM student_attendance
    JOIN class_attendance_sheets ON student_attendance.sheet_id = class_attendance_sheets.id
    GROUP BY student_id
)

SELECT 
    s.id as student_id,
    s.name as student_name,
    s.avatar_url,
    cc.class_name,
    cc.class_id,
    cc.school_year,
    
    -- Stats
    COALESCE(aa.total_records, 0) as total_records,
    COALESCE(aa.present_count, 0) as present_count,
    COALESCE(aa.absent_count, 0) as absent_count,
    COALESCE(aa.justified_count, 0) as justified_count,
    
    -- Pedagogical Rate Calculation: (Present + Justified) / Total * 100
    CASE 
        WHEN COALESCE(aa.total_records, 0) = 0 THEN 100 -- Default to 100% if no records
        ELSE ROUND(
            ((COALESCE(aa.present_count, 0) + COALESCE(aa.justified_count, 0))::numeric / aa.total_records::numeric) * 100, 
            1
        )
    END as attendance_rate,
    
    aa.last_attendance_date

FROM students s
JOIN current_classes cc ON cc.student_id = s.id
LEFT JOIN attendance_aggregates aa ON aa.student_id = s.id
WHERE s.status = 'active'; -- Only active students
