-- Add 'term' and 'subject' columns to grade_books table
-- This enables the "Boletim" (Report Card) view where grades are organized by Term and Subject.

ALTER TABLE grade_books 
ADD COLUMN IF NOT EXISTS term text DEFAULT '1_bimestre',
ADD COLUMN IF NOT EXISTS subject text;

-- Optional: Create an index for faster filtering
-- CREATE INDEX IF NOT EXISTS idx_grade_books_term_class ON grade_books(class_id, term);
