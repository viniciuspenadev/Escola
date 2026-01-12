-- Enable RLS (if not already enabled)
ALTER TABLE grade_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;

-- Policy for Parents/Guardians to view Grade Books (Assessments)
-- Logic: Allow if the user is a guardian of ANY student enrolled in the class of the grade book.
CREATE POLICY "Guardians can view grade books for their students classes" ON grade_books
FOR SELECT
TO authenticated
USING (
  exists (
    select 1
    from class_enrollments ce
    join student_guardians sg on sg.student_id = ce.student_id
    where ce.class_id = grade_books.class_id
    and sg.guardian_id = auth.uid()
  )
);

-- Policy for Parents/Guardians to view Student Grades (Scores)
-- Logic: Allow if the user is a guardian of the student who owns the grade.
CREATE POLICY "Guardians can view grades for their students" ON student_grades
FOR SELECT
TO authenticated
USING (
  exists (
    select 1
    from student_guardians sg
    where sg.student_id = student_grades.student_id
    and sg.guardian_id = auth.uid()
  )
);

-- Ensure Teachers/Admins can still view/edit (Basic policies, might duplicate existing ones so using IF NOT EXISTS logic implicitly by separate names or purely additive)
-- Ideally you check existing policies first. Assuming standard setup:

-- Policy for Teachers to view/manage grade books (Broad simplified policy for now, assuming teachers are trusted or using a different role mechanism. If you rely on 'authenticated' generic, conflict might suggest restricting.)
-- For this fix, we focus on Parents.

-- NOTE: If you already have policies, these might just add to them.
