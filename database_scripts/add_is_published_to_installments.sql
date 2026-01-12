-- Add is_published column to installments table
-- Default is FALSE (Draft mode)
ALTER TABLE installments 
ADD COLUMN is_published BOOLEAN DEFAULT FALSE;

-- Optional: Create an index if we plan to filter by this frequently
CREATE INDEX idx_installments_is_published ON installments(is_published);

-- Update RLS policies (Example - Adjust based on your actual policies)
-- Parents should only see published installments
-- CREATE POLICY "Parents view published only" ON installments
-- FOR SELECT
-- TO authenticated
-- USING (
--   (auth.uid() = (SELECT user_id FROM students WHERE students.id = installments.student_id)) -- simplified linkage logic
--   AND is_published = true
-- );
