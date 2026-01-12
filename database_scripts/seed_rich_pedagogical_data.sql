
-- Seed Rich Pedagogical Data (Mock Replication)

-- 1. Create a Class (if not exists)
INSERT INTO public.classes (id, name, capacity, room, shift, year, status)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'Berçário II - Manhã', 20, 'Sala 01', 'morning', 2025, 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Link Student to Class (Enroll)
INSERT INTO public.class_enrollments (class_id, student_id, status)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'd4f20466-2036-4132-9ac1-cc76c28b7735', 'active')
ON CONFLICT (class_id, student_id) DO NOTHING;

-- 3. Clear existing simple reports to show the rich ones clearly
DELETE FROM public.daily_reports WHERE student_id = 'd4f20466-2036-4132-9ac1-cc76c28b7735';

-- 4. Insert Rich Daily Reports (Past 3 days)
-- Report 1 (Today/Yesterday)
INSERT INTO public.daily_reports (student_id, class_id, date, routine_data, activities)
VALUES (
    'd4f20466-2036-4132-9ac1-cc76c28b7735',
    'c1111111-1111-1111-1111-111111111111',
    CURRENT_DATE - 1,
    '{"mood": "😄 Feliz", "meals": {"lunch": "Comeu Tudo", "snack": "Aceitou Bem"}, "sleep": {"nap": "Dormiu Bem"}, "hygiene": "Ok"}'::jsonb,
    'Hoje o aluno participou ativamente das atividades de pintura. Fez amizade com o novo colega e se comportou muito bem durante o almoço.'
);

-- Report 2
INSERT INTO public.daily_reports (student_id, class_id, date, routine_data, activities)
VALUES (
    'd4f20466-2036-4132-9ac1-cc76c28b7735',
    'c1111111-1111-1111-1111-111111111111',
    CURRENT_DATE - 2,
    '{"mood": "🥱 Cansado", "meals": {"lunch": "Comeu Pouco", "snack": "Comeu Tudo"}, "sleep": {"nap": "Não dormiu"}, "hygiene": "Troca 2x"}'::jsonb,
    'Dia mais agitado, demonstrou cansaço após o parque. Participou da hora do conto com atenção.'
);

-- Report 3
INSERT INTO public.daily_reports (student_id, class_id, date, routine_data, activities)
VALUES (
    'd4f20466-2036-4132-9ac1-cc76c28b7735',
    'c1111111-1111-1111-1111-111111111111',
    CURRENT_DATE - 3,
    '{"mood": "😄 Feliz", "meals": {"lunch": "Repetiu", "snack": "Comeu Tudo"}, "sleep": {"nap": "Dormiu Bem"}, "hygiene": "Ok"}'::jsonb,
    'Excelente dia! Brincou com blocos e ajudou a organizar a sala.'
);


-- 5. Seed Attendance (To hit 96% Mock)
-- 25 total, 1 absent, 24 present
DELETE FROM public.student_attendance WHERE student_id = 'd4f20466-2036-4132-9ac1-cc76c28b7735';

-- Insert 1 Absent
INSERT INTO public.student_attendance (student_id, status, notes) VALUES ('d4f20466-2036-4132-9ac1-cc76c28b7735', 'absent', 'Resfriado');
-- Insert 1 Justified
INSERT INTO public.student_attendance (student_id, status, notes) VALUES ('d4f20466-2036-4132-9ac1-cc76c28b7735', 'justified', 'Consulta Médica');
-- Insert 23 Presents
INSERT INTO public.student_attendance (student_id, status)
SELECT 'd4f20466-2036-4132-9ac1-cc76c28b7735', 'present' FROM generate_series(1, 23);


-- 6. Seed Grade Books & Grades (Exact Match)
DELETE FROM public.student_grades WHERE student_id = 'd4f20466-2036-4132-9ac1-cc76c28b7735';
DELETE FROM public.grade_books WHERE class_id = 'c1111111-1111-1111-1111-111111111111';

-- Grades Definition
DO $$
DECLARE
    gb_id_1 UUID;
    gb_id_2 UUID;
    gb_id_3 UUID;
    gb_id_4 UUID;
BEGIN
    INSERT INTO public.grade_books (class_id, term, subject, title, max_score) VALUES ('c1111111-1111-1111-1111-111111111111', '4_bimestre', 'Linguagem Oral e Escrita', 'Avaliação Geral', 10.0) RETURNING id INTO gb_id_1;
    INSERT INTO public.grade_books (class_id, term, subject, title, max_score) VALUES ('c1111111-1111-1111-1111-111111111111', '4_bimestre', 'Matemática', 'Avaliação Geral', 10.0) RETURNING id INTO gb_id_2;
    INSERT INTO public.grade_books (class_id, term, subject, title, max_score) VALUES ('c1111111-1111-1111-1111-111111111111', '4_bimestre', 'Natureza e Sociedade', 'Avaliação Geral', 10.0) RETURNING id INTO gb_id_3;
    INSERT INTO public.grade_books (class_id, term, subject, title, max_score) VALUES ('c1111111-1111-1111-1111-111111111111', '4_bimestre', 'Artes Visuais', 'Avaliação Geral', 10.0) RETURNING id INTO gb_id_4;

    INSERT INTO public.student_grades (grade_book_id, student_id, score) VALUES (gb_id_1, 'd4f20466-2036-4132-9ac1-cc76c28b7735', 9.0); -- A
    INSERT INTO public.student_grades (grade_book_id, student_id, score) VALUES (gb_id_2, 'd4f20466-2036-4132-9ac1-cc76c28b7735', 7.5); -- B
    INSERT INTO public.student_grades (grade_book_id, student_id, score) VALUES (gb_id_3, 'd4f20466-2036-4132-9ac1-cc76c28b7735', 9.5); -- A
    INSERT INTO public.student_grades (grade_book_id, student_id, score) VALUES (gb_id_4, 'd4f20466-2036-4132-9ac1-cc76c28b7735', 10.0); -- A+
END $$;
