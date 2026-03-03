import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Download, FileText, GripVertical, Trash2, Loader2, CheckCircle, Grid, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { Document, Packer, LevelFormat, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { buildHeaderSection, buildQuestionsSection, buildAnswerSection, buildMatrixSection } from '@/services/docxBuilder';
import Latex from '@/components/Latex';
import 'katex/dist/katex.min.css';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuthStore();
  const { currentProject, projectQuestions, loading, fetchProjectDetails, removeQuestionFromProject, reorderQuestions } = useProjectStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'answers' | 'matrix'>('questions');

  useEffect(() => {
    if (id && session?.user.id) {
      fetchProjectDetails(id);
    }
  }, [id, session?.user.id, fetchProjectDetails]);

  const handleRemove = async (questionId: string) => {
    const result = await Swal.fire({
      title: 'Hapus Soal?',
      text: "Soal ini akan dikeluarkan dari proyek.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await removeQuestionFromProject(questionId);
        Swal.fire('Terhapus!', 'Soal telah dihapus dari proyek.', 'success');
      } catch (error) {
        Swal.fire('Error', 'Gagal menghapus soal.', 'error');
      }
    }
  };

  // Simple manual reorder for now (move up/down)
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (!id) return;
    const newQuestions = [...projectQuestions];
    if (direction === 'up' && index > 0) {
      [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
    } else if (direction === 'down' && index < newQuestions.length - 1) {
      [newQuestions[index + 1], newQuestions[index]] = [newQuestions[index], newQuestions[index + 1]];
    } else {
      return;
    }
    reorderQuestions(id, newQuestions);
  };

  const handleDownloadDocx = async () => {
    if (!currentProject || projectQuestions.length === 0) return;
    setIsDownloading(true);

    try {
      // Group questions by type for DOCX builder
      const groupedQuestionsForDoc = projectQuestions.reduce((acc: any, pq) => {
        const q = pq.questions?.content;
        if (!q) return acc;
        const type = q._type || 'multiple_choice';
        if (!acc[type]) acc[type] = [];
        acc[type].push(q);
        return acc;
      }, {});

      // Mock formData for header
      const formData = {
        subject: currentProject.subject,
        class_grade: currentProject.class_grade,
        topic: currentProject.name,
      };

      const doc = new Document({
        numbering: {
          config: [
            {
              reference: "question-numbering",
              levels: [
                {
                  level: 0,
                  format: LevelFormat.DECIMAL,
                  text: "%1.",
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                },
                {
                  level: 1,
                  format: LevelFormat.UPPER_LETTER,
                  text: "%2.",
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
                },
              ],
            },
            {
              reference: "bullet-numbering",
              levels: [
                {
                  level: 0,
                  format: LevelFormat.BULLET,
                  text: "o",
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
                },
              ],
            },
            {
              reference: "answer-numbering",
              levels: [
                {
                  level: 0,
                  format: LevelFormat.DECIMAL,
                  text: "%1.",
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                },
              ],
            },
          ],
        },
        sections: [{
          properties: {},
          children: [
            ...buildHeaderSection(currentProject, formData),
            ...buildQuestionsSection(groupedQuestionsForDoc, {}), // Empty imageStates for now
            ...buildAnswerSection(groupedQuestionsForDoc),
            ...buildMatrixSection(groupedQuestionsForDoc, formData)
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Proyek_${currentProject.name.replace(/\s+/g, '_')}.docx`);
    } catch (error) {
      console.error("Error generating DOCX:", error);
      Swal.fire('Error', 'Gagal mengunduh dokumen. Silakan coba lagi.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const latexDelimiters = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
  ];

  if (loading && !currentProject) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-royal-blue-600" size={32} />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-700">Proyek tidak ditemukan</h2>
        <Link to="/projects" className="text-royal-blue-600 hover:underline mt-4 inline-block">Kembali ke Daftar Proyek</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex-none px-8 py-6 border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/projects" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{currentProject.name}</h1>
            <p className="text-sm text-slate-500">
              {currentProject.subject} • {currentProject.class_grade} • {projectQuestions.length} Soal
            </p>
          </div>
          <div className="ml-auto flex gap-3">
            <Link 
              to={`/history?projectId=${id}`}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors flex items-center gap-2 text-sm"
            >
              <Plus size={16} /> Tambah Soal dari Riwayat
            </Link>
            <button 
              onClick={handleDownloadDocx}
              disabled={isDownloading || projectQuestions.length === 0}
              className="px-4 py-2 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 text-sm shadow-md shadow-royal-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export DOCX
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: 'questions', label: 'Daftar Soal', icon: FileText },
            { id: 'answers', label: 'Kunci Jawaban', icon: CheckCircle },
            { id: 'matrix', label: 'Kisi-Kisi', icon: Grid }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 rounded-t-lg border-b-2 ${
                activeTab === tab.id
                  ? "text-royal-blue-600 border-royal-blue-600 bg-royal-blue-50"
                  : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {projectQuestions.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed max-w-2xl mx-auto">
            <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-900">Proyek masih kosong</h3>
            <p className="text-slate-500 mt-1 mb-6">Buka Riwayat Soal untuk memilih dan menambahkan soal ke proyek ini.</p>
            <Link 
              to="/history"
              className="inline-flex px-6 py-3 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl transition-colors items-center gap-2"
            >
              <Plus size={18} /> Buka Riwayat Soal
            </Link>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {activeTab === 'questions' && projectQuestions.map((pq, index) => {
              const q = pq.questions?.content;
              if (!q) return null;
              return (
                <div key={pq.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group flex gap-4">
                  {/* Reorder Controls */}
                  <div className="flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => moveQuestion(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-royal-blue-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <GripVertical size={20} className="text-slate-300 cursor-grab" />
                    <button 
                      onClick={() => moveQuestion(index, 'down')}
                      disabled={index === projectQuestions.length - 1}
                      className="p-1 text-slate-400 hover:text-royal-blue-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-slate-900">{index + 1}.</span>
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-medium capitalize">
                          {q._type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-md font-medium">
                          C{q._cognitive_level}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleRemove(pq.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus dari Proyek"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {q.stimulus && (
                      <div className="mb-4 text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        {typeof q.stimulus === 'string' ? (
                          <Latex delimiters={latexDelimiters}>{q.stimulus}</Latex>
                        ) : (
                          <span className="italic text-slate-500">[Stimulus Terstruktur]</span>
                        )}
                      </div>
                    )}
                    
                    <div className="text-slate-800 font-medium mb-4">
                      <Latex delimiters={latexDelimiters}>{q.question}</Latex>
                    </div>

                    {q.options && (
                      <div className="space-y-2 pl-4">
                        {q.options.map((opt: string, i: number) => (
                          <div key={i} className="flex gap-3 text-sm text-slate-700">
                            <span className="font-bold">{String.fromCharCode(65 + i)}.</span>
                            <span><Latex delimiters={latexDelimiters}>{opt}</Latex></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {activeTab === 'answers' && projectQuestions.map((pq, index) => {
              const q = pq.questions?.content;
              if (!q) return null;
              return (
                <div key={pq.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex gap-4">
                  <span className="font-bold text-lg text-slate-900">{index + 1}.</span>
                  <div className="flex-1">
                    <div className="mb-2">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                        Jawaban: <Latex delimiters={latexDelimiters}>{q.correct_answer || '-'}</Latex>
                      </span>
                    </div>
                    <div className="text-sm text-slate-700 mt-4">
                      <span className="font-bold block mb-1 text-slate-900">Pembahasan:</span>
                      <Latex delimiters={latexDelimiters}>{q.explanation || '-'}</Latex>
                    </div>
                  </div>
                </div>
              );
            })}

            {activeTab === 'matrix' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-700 w-16 text-center">No</th>
                      <th className="px-6 py-4 font-bold text-slate-700">Tujuan Pembelajaran</th>
                      <th className="px-6 py-4 font-bold text-slate-700">Materi</th>
                      <th className="px-6 py-4 font-bold text-slate-700 w-24 text-center">Level</th>
                      <th className="px-6 py-4 font-bold text-slate-700 w-32 text-center">Tipe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectQuestions.map((pq, index) => {
                      const q = pq.questions?.content;
                      if (!q) return null;
                      return (
                        <tr key={pq.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-center font-medium text-slate-900">{index + 1}</td>
                          <td className="px-6 py-4 text-slate-700">{q._learning_objective || q._learning_objectives || '-'}</td>
                          <td className="px-6 py-4 text-slate-700">{q._topic ? (Array.isArray(q._topic) ? q._topic[0] : String(q._topic).split(',')[0].trim()) : '-'}</td>
                          <td className="px-6 py-4 text-center text-slate-700 font-medium">C{q._cognitive_level}</td>
                          <td className="px-6 py-4 text-center text-slate-700 capitalize text-xs">{q._type?.replace(/_/g, ' ')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
