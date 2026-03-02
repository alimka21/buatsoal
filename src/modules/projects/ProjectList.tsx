import React, { useEffect, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';
import { Folder, Plus, Trash2, Calendar, BookOpen, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Swal from 'sweetalert2';

export default function ProjectList() {
  const { session } = useAuthStore();
  const { projects, loading, fetchProjects, createProject, deleteProject } = useProjectStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', subject: '', class_grade: '' });

  useEffect(() => {
    if (session?.user.id) {
      fetchProjects(session.user.id);
    }
  }, [session?.user.id, fetchProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.id) return;
    
    if (!newProject.name) {
      Swal.fire('Error', 'Nama proyek wajib diisi', 'error');
      return;
    }

    const created = await createProject(session.user.id, newProject);
    if (created) {
      setIsCreating(false);
      setNewProject({ name: '', description: '', subject: '', class_grade: '' });
      Swal.fire('Berhasil', 'Proyek baru berhasil dibuat', 'success');
    }
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    const result = await Swal.fire({
      title: 'Hapus Proyek?',
      text: "Semua soal di dalam proyek ini akan ikut terhapus (soal asli di riwayat tetap aman).",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await deleteProject(projectId);
        Swal.fire('Terhapus!', 'Proyek telah dihapus.', 'success');
      } catch (error) {
        Swal.fire('Error', 'Gagal menghapus proyek.', 'error');
      }
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 h-full overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Folder className="text-royal-blue-600" size={28} />
            Proyek Soal
          </h1>
          <p className="text-slate-500 mt-1">Rakit dan kelola kumpulan soal dari berbagai sesi generate.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> Buat Proyek Baru
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-2xl border border-royal-blue-100 shadow-md animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Proyek Baru</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Nama Proyek *</label>
                <input 
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                  placeholder="Contoh: UAS Biologi Semester 1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500 outline-none text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Mata Pelajaran</label>
                <input 
                  value={newProject.subject}
                  onChange={e => setNewProject({...newProject, subject: e.target.value})}
                  placeholder="Contoh: Biologi"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500 outline-none text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Kelas / Fase</label>
                <input 
                  value={newProject.class_grade}
                  onChange={e => setNewProject({...newProject, class_grade: e.target.value})}
                  placeholder="Contoh: Kelas 10 Fase E"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500 outline-none text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Deskripsi (Opsional)</label>
                <input 
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                  placeholder="Keterangan tambahan..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500 outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-xl transition-colors text-sm"
              >
                Batal
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl transition-colors text-sm"
              >
                Simpan Proyek
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && projects.length === 0 ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-royal-blue-600"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed">
          <Folder className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">Belum ada proyek</h3>
          <p className="text-slate-500 mt-1">Buat proyek pertama Anda untuk mulai merakit soal.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Proyek</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mata Pelajaran</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Kelas/Fase</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dibuat Pada</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <Link to={`/projects/${project.id}`} className="block">
                        <div className="font-bold text-slate-800 group-hover:text-royal-blue-600 transition-colors">{project.name}</div>
                        {project.description && <div className="text-sm text-slate-500 mt-1 truncate max-w-xs">{project.description}</div>}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <BookOpen size={16} className="text-slate-400" />
                        {project.subject || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <GraduationCap size={16} className="text-slate-400" />
                        {project.class_grade || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar size={16} className="text-slate-400" />
                        {format(new Date(project.created_at), 'dd MMM yyyy', { locale: id })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => handleDelete(project.id, e)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                        title="Hapus Proyek"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
