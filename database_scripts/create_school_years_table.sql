-- Create school_years table
CREATE TABLE IF NOT EXISTS school_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year VARCHAR(4) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'closed', -- 'active', 'planning', 'closed'
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE school_years ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read access" ON school_years FOR SELECT USING (true);
CREATE POLICY "Admin insert access" ON school_years FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update access" ON school_years FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete access" ON school_years FOR DELETE USING (auth.role() = 'authenticated');

-- Insert Initial Data (Safe Insert)
INSERT INTO school_years (year, status, is_current, start_date, end_date)
VALUES 
  ('2024', 'closed', false, '2024-01-01', '2024-12-31'),
  ('2025', 'active', true, '2025-01-01', '2025-12-31'),
  ('2026', 'planning', false, '2026-01-01', '2026-12-31')
ON CONFLICT (year) DO NOTHING;
