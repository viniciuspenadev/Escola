-- Enhance financial_plans table to support more flexible product definitions
ALTER TABLE financial_plans 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'tuition', -- 'tuition', 'material', 'service'
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS academic_year INTEGER DEFAULT 2026;

-- Create constraint for valid types if desired (optional)
-- ADD CONSTRAINT financial_plans_type_check CHECK (type IN ('tuition', 'material', 'service', 'uniform'));

-- Insert some default seed data if table is empty
INSERT INTO financial_plans (title, total_value, installments_count, type, academic_year, active)
SELECT 'Anuidade 2026 - Integral', 24000.00, 12, 'tuition', 2026, true
WHERE NOT EXISTS (SELECT 1 FROM financial_plans WHERE title = 'Anuidade 2026 - Integral');

INSERT INTO financial_plans (title, total_value, installments_count, type, academic_year, active)
SELECT 'Kit Material Didático 2026', 1500.00, 3, 'material', 2026, true
WHERE NOT EXISTS (SELECT 1 FROM financial_plans WHERE title = 'Kit Material Didático 2026');

INSERT INTO financial_plans (title, total_value, installments_count, type, academic_year, active)
SELECT 'Uniforme Completo (Kit)', 650.00, 2, 'uniform', 2026, true
WHERE NOT EXISTS (SELECT 1 FROM financial_plans WHERE title = 'Uniforme Completo (Kit)');
