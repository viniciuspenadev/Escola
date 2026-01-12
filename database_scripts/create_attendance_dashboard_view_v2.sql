-- View for Attendance Management Dashboard
-- Fixed to aggregate by Student + Year (so we can see 2025 even if 2026 exists)

DROP VIEW IF EXISTS attendance_dashboard_view;

CREATE OR REPLACE VIEW attendance_dashboard_view AS
WITH enrollment_data AS (
    -- Get ALL class enrollments, not just the latest
    SELECT 
        ce.student_id,
        c.name as class_name,
        c.id as class_id,
        c.school_year
    FROM class_enrollments ce
    JOIN classes c ON ce.class_id = c.id
),
attendance_aggregates AS (
    -- Aggregate attendance by Student AND School Year
    SELECT
        sa.student_id,
        c.school_year,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE sa.status = 'present') as present_count,
        COUNT(*) FILTER (WHERE sa.status = 'absent') as absent_count,
        COUNT(*) FILTER (WHERE sa.status = 'justified') as justified_count,
        MAX(cas.date) as last_attendance_date
    FROM student_attendance sa
    JOIN class_attendance_sheets cas ON sa.sheet_id = cas.id
    JOIN classes c ON cas.class_id = c.id
    GROUP BY sa.student_id, c.school_year
)

SELECT 
    s.id as student_id,
    s.name as student_name,
    ed.class_name,
    ed.class_id,
    ed.school_year,
    
    -- Stats (Matched by Student + Year)
    COALESCE(aa.total_records, 0) as total_records,
    COALESCE(aa.present_count, 0) as present_count,
    COALESCE(aa.absent_count, 0) as absent_count,
    COALESCE(aa.justified_count, 0) as justified_count,
    
    -- Pedagogical Rate: (Present + Justified) / Total * 100
    CASE 
        WHEN COALESCE(aa.total_records, 0) = 0 THEN 100 
        ELSE ROUND(
            ((COALESCE(aa.present_count, 0) + COALESCE(aa.justified_count, 0))::numeric / aa.total_records::numeric) * 100, 
            1
        )
    END as attendance_rate,
    
    aa.last_attendance_date

FROM enrollment_data ed
JOIN students s ON ed.student_id = s.id
-- Left join stats on both ID and Year
LEFT JOIN attendance_aggregates aa ON aa.student_id = ed.student_id AND aa.school_year = ed.school_year
WHERE s.status = 'active';
