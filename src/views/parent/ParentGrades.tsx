import { type FC, useState, useEffect } from 'react';
import { useStudent } from '../../contexts/StudentContext';
import { supabase } from '../../services/supabase';
import { FileText, ChevronDown, ChevronUp, GraduationCap, AlertCircle } from 'lucide-react';

interface GradeBook {
    id: string;
    title: string;
    term: string;
    subject: string;
    max_score: number;
    weight: number;
    date: string;
}

interface StudentGrade {
    grade_book_id: string;
    score: number;
}

interface SubjectData {
    name: string;
    terms: Record<string, {
        assessments: GradeBook[];
        grades: Record<string, number>; // assessment_id -> score
        totalScore: number;
        maxPossible: number;
    }>;
    overallScore: number;
    overallMax: number;
}

export const ParentGrades: FC = () => {
    const { selectedStudent } = useStudent();
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState<SubjectData[]>([]);
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
    const [selectedTerm, setSelectedTerm] = useState('1_bimestre');

    useEffect(() => {
        if (selectedStudent) {
            fetchGrades();
        }
    }, [selectedStudent]);

    const fetchGrades = async () => {
        if (!selectedStudent) return;
        setLoading(true);
        try {
            // 1. Get Enrollments to find Classes
            const { data: enrollments, error: enrollError } = await supabase
                .from('class_enrollments')
                .select('class_id, classes!inner(id, name, school_year)')
                .eq('student_id', selectedStudent!.id)
                .eq('classes.school_year', selectedStudent.academic_year);

            if (enrollError) throw enrollError;

            const classIds = enrollments?.map(e => e.class_id) || [];
            if (classIds.length === 0) {
                setSubjects([]);
                return;
            }

            // 2. Fetch GradeBooks (All terms)
            const { data: gradeBooks, error: gbError } = await supabase
                .from('grade_books')
                .select('*')
                .in('class_id', classIds)
                .order('date', { ascending: false });

            if (gbError) throw gbError;

            // 3. Fetch Student Grades
            const { data: grades, error: gError } = await supabase
                .from('student_grades')
                .select('*')
                .eq('student_id', selectedStudent!.id)
                .in('grade_book_id', gradeBooks?.map(gb => gb.id) || []);

            if (gError) throw gError;

            // 4. Process Data
            const subjectMap: Record<string, SubjectData> = {};

            gradeBooks?.forEach((gb: GradeBook) => {
                const subjectName = gb.subject || 'Geral';

                if (!subjectMap[subjectName]) {
                    subjectMap[subjectName] = {
                        name: subjectName,
                        terms: {},
                        overallScore: 0,
                        overallMax: 0
                    };
                }

                if (!subjectMap[subjectName].terms[gb.term]) {
                    subjectMap[subjectName].terms[gb.term] = {
                        assessments: [],
                        grades: {},
                        totalScore: 0,
                        maxPossible: 0
                    };
                }

                const termData = subjectMap[subjectName].terms[gb.term];
                termData.assessments.push(gb);

                const grade = grades?.find((g: StudentGrade) => g.grade_book_id === gb.id);

                // Only add to totals if grade exists or if we want to count ungarded as 0? 
                // Usually for "Average" we might only count graded, or count all. 
                // Let's stick to simple sum for now as per previous logic.
                termData.maxPossible += gb.weight; // Using weight for average calculation now, or keeping simple score sum? 
                // The Teacher view uses Weighted Average: sum(score * weight) / sum(weight).
                // Let's implement Weighted Average here to match Teacher View.

                if (grade) {
                    termData.grades[gb.id] = grade.score;
                }
            });

            // Calculate Weighted Averages for each Term
            Object.values(subjectMap).forEach(subject => {
                Object.values(subject.terms).forEach(term => {
                    let totalWeightedScore = 0;
                    let totalWeight = 0;

                    term.assessments.forEach(assessment => {
                        const score = term.grades[assessment.id];
                        if (score !== undefined) {
                            totalWeightedScore += score * assessment.weight;
                            totalWeight += assessment.weight;
                        }
                    });

                    term.totalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;
                    term.maxPossible = 10; // Normalized to 10 scale
                });
            });

            setSubjects(Object.values(subjectMap).sort((a, b) => a.name.localeCompare(b.name)));

        } catch (error) {
            console.error('Error fetching grades:', error);
        } finally {
            setLoading(false);
        }
    };

    const TERMS = [
        { id: '1_bimestre', label: '1º Bimestre' },
        { id: '2_bimestre', label: '2º Bimestre' },
        { id: '3_bimestre', label: '3º Bimestre' },
        { id: '4_bimestre', label: '4º Bimestre' },
    ];

    const getScoreColor = (score: number) => {
        if (score >= 6) return 'text-green-600 bg-green-50 border-green-200'; // Using 6.0 as passing grade based on Teacher View
        if (score >= 4) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-brand-100 rounded-xl text-brand-600">
                        <GraduationCap className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Boletim Escolar</h2>
                </div>
                <p className="text-sm text-gray-500 ml-1">
                    Acompanhe o desempenho acadêmico e as avaliações.
                </p>
            </div>

            {/* Term Selector */}
            <div className="flex px-1 gap-2 overflow-x-auto pb-2 -mx-4 md:mx-0 px-4 md:px-0 no-scrollbar">
                {TERMS.map(term => (
                    <button
                        key={term.id}
                        onClick={() => setSelectedTerm(term.id)}
                        className={`
                            px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all
                            ${selectedTerm === term.id
                                ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}
                        `}
                    >
                        {term.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white h-24 rounded-2xl animate-pulse shadow-sm" />
                    ))}
                </div>
            ) : subjects.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhuma nota encontrada</h3>
                    <p className="text-gray-500 text-sm">
                        As avaliações aparecerão aqui assim que forem lançadas.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {subjects.map((subject) => {
                        const termData = subject.terms[selectedTerm];

                        // If no data for this term, skip or show placeholder?
                        // Showing subject is useful even if "Sem notas" to know it exists.
                        // But if strictly no assessments, maybe skip. 
                        // Let's show it if it exists in the map, otherwise it implies the subject might not be active this term?
                        // Actually better to show all subjects that have EVER had data, but differentiate if empty for this term.

                        // For now, let's filter: Only show if termData exists (assessments exist for this term)
                        if (!termData) return null;

                        const isExpanded = expandedSubject === subject.name;
                        const scoreColor = getScoreColor(termData.totalScore);

                        return (
                            <div key={subject.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
                                {/* Subject Header Card */}
                                <button
                                    onClick={() => setExpandedSubject(isExpanded ? null : subject.name)}
                                    className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border ${scoreColor}`}>
                                            {termData.totalScore.toFixed(1)}
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-bold text-gray-900 text-lg">{subject.name}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Média do Bimestre
                                            </p>
                                        </div>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 bg-gray-50/30">
                                        <div className="p-5 space-y-3">
                                            {termData.assessments.map(assessment => {
                                                const score = termData.grades[assessment.id];
                                                const hasScore = score !== undefined;

                                                return (
                                                    <div key={assessment.id} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                                {assessment.title}
                                                            </p>
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                {new Date(assessment.date + 'T12:00:00').toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            {hasScore ? (
                                                                <div className={`font-bold text-sm px-2.5 py-1 rounded-lg ${(score / assessment.max_score) >= 0.6 ? 'bg-green-50 text-green-700' :
                                                                    (score / assessment.max_score) >= 0.4 ? 'bg-yellow-50 text-yellow-700' :
                                                                        'bg-red-50 text-red-700'
                                                                    }`}>
                                                                    {Number(score).toFixed(1)}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic flex items-center gap-1">
                                                                    <AlertCircle className="w-3 h-3" /> Pendente
                                                                </span>
                                                            )}
                                                            <p className="text-[10px] text-gray-300 mt-1 text-center font-medium">
                                                                Peso: {assessment.weight}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Empty State for specific term */}
                    {subjects.every(s => !s.terms[selectedTerm]) && (
                        <div className="py-12 text-center">
                            <p className="text-gray-400">Nenhuma avaliação encontrada para o {TERMS.find(t => t.id === selectedTerm)?.label}.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
