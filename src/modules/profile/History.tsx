import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { format } from 'date-fns';
import { Loader2, Search, Filter, Database, Folder, Trash2, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/utils/cn';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

export default function History() {
  const { session } = useAuthStore();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  const { projects, fetchProjects, addQuestionsToProject } = useProjectStore();
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredQuestions = questions.filter(q => {
    const matchSubject = filterSubject ? q.subject === filterSubject : true;
    const matchType = filterType ? q.question_type === filterType : true;
    const matchSearch = searchQuery ? 
      q.content?.question?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.topic?.toLowerCase().includes(searchQuery.toLowerCase()) 
      : true;
    return matchSubject && matchType && matchSearch;
  });

  const uniqueSubjects = Array.from(new Set(questions.map(q => q.subject).filter(Boolean)));
  const uniqueTypes = Array.from(new Set(questions.map(q => q.question_type).filter(Boolean)));

  useEffect(() => {
    if (session) {
      fetchQuestions();
      fetchProjects(session.user.id);
    }
  }, [session]);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('user_id', session?.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      console.error("Error fetching questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Soal?',
      text: "Soal ini akan dihapus dari bank soal.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('questions')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        setQuestions(questions.filter(item => item.id !== id));
        selectedQuestions.delete(id);
        setSelectedQuestions(new Set(selectedQuestions));
        Swal.fire('Terhapus!', 'Soal telah dihapus.', 'success');
      } catch (err) {
        Swal.fire('Error', 'Gagal menghapus data.', 'error');
      }
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedQuestions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedQuestions(newSet);
  };

  const selectAll = () => {
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const handleAddToProject = async (projectId: string) => {
    if (selectedQuestions.size === 0) return;
    
    try {
      await addQuestionsToProject(projectId, Array.from(selectedQuestions));
      setShowProjectModal(false);
      setSelectedQuestions(new Set());
      Swal.fire('Berhasil', `${selectedQuestions.size} soal berhasil ditambahkan ke proyek.`, 'success');
    } catch (error) {
      Swal.fire('Error', 'Gagal menambahkan soal ke proyek.', 'error');
    }
  };

  const latexDelimiters = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
  ];

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-royal-blue-600" /></div>;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-hidden font-sans">
      <div className="flex-none px-8 py-8 border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="text-royal-blue-600" size={32} />
              Bank Soal
            </h2>
            <p className="text-sm text-slate-500 mt-1">Kelola semua soal yang pernah Anda buat. Pilih dan masukkan ke dalam proyek.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 w-64 outline-none transition-all" 
                placeholder="Cari soal..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors outline-none"
            >
              <option value="">Semua Mata Pelajaran</option>
              {uniqueSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors outline-none capitalize"
            >
              <option value="">Semua Tipe Soal</option>
              {uniqueTypes.map(type => (
                <option key={type as string} value={type as string}>{(type as string)?.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Action Bar */}
        <div className="max-w-6xl mx-auto w-full mt-6 flex items-center justify-between">
          <button
            onClick={selectAll}
            className="text-sm font-medium text-slate-600 hover:text-royal-blue-600 transition-colors"
          >
            {selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua'}
          </button>
          
          {selectedQuestions.size > 0 && (
            <button
              onClick={() => setShowProjectModal(true)}
              className="px-4 py-2 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 text-sm shadow-md shadow-royal-blue-500/20 animate-in fade-in"
            >
              <Folder size={16} />
              Tambah ke Proyek ({selectedQuestions.size})
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto w-full space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Database size={40} className="opacity-20" />
              </div>
              <p className="font-medium text-slate-600">Bank soal masih kosong</p>
              <p className="text-sm mt-1">Mulai buat soal di menu Generator untuk mengisi bank soal.</p>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const content = q.content;
              const isSelected = selectedQuestions.has(q.id);
              
              return (
                <div 
                  key={q.id} 
                  className={cn(
                    "bg-white rounded-2xl border p-6 shadow-sm transition-all flex gap-4 cursor-pointer group",
                    isSelected ? "border-royal-blue-500 ring-1 ring-royal-blue-500 bg-royal-blue-50/10" : "border-slate-200 hover:border-royal-blue-300"
                  )}
                  onClick={() => toggleSelection(q.id)}
                >
                  <div className="pt-1">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => {}} // Handled by parent div click
                      className="w-5 h-5 rounded border-slate-300 text-royal-blue-600 focus:ring-royal-blue-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600">
                        {q.subject || 'Umum'}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-700">
                        C{q.cognitive_level}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-orange-50 text-orange-700 capitalize">
                        {q.question_type?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {format(new Date(q.created_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                    </div>
                    
                    <div className="text-slate-800 font-medium text-sm line-clamp-3 mb-2">
                      <Latex delimiters={latexDelimiters}>{content.question}</Latex>
                    </div>
                    
                    <div className="text-xs text-slate-500 truncate">
                      <span className="font-semibold">Topik:</span> {q.topic}
                    </div>
                  </div>
                  <div className="flex-none flex flex-col items-end gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Hapus Soal"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Project Selection Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Tambahkan ke Proyek</h3>
              <p className="text-sm text-slate-500 mt-1">Pilih proyek untuk menyimpan {selectedQuestions.size} soal ini.</p>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {projects.length === 0 ? (
                <div className="text-center py-8">
                  <Folder className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">Belum ada proyek.</p>
                  <p className="text-slate-400 text-xs mt-1">Buat proyek baru di menu Proyek Soal.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleAddToProject(project.id)}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-royal-blue-500 hover:bg-royal-blue-50 transition-all group"
                    >
                      <h4 className="font-bold text-slate-800 group-hover:text-royal-blue-700">{project.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{project.subject} • {project.class_grade}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 font-medium rounded-xl transition-colors text-sm"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
