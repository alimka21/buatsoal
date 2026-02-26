import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { useGeneratorStore } from '@/store/generatorStore';
import { format, isToday, isYesterday } from 'date-fns';
import { Loader2, Search, Filter, History as HistoryIcon, ArrowRight, RefreshCw, Edit, Trash2, FileText, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/utils/cn';
import { useNavigate } from 'react-router-dom';

export default function History() {
  const { session } = useAuthStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) fetchHistory();
  }, [session]);

  const fetchHistory = async () => {
    try {
      // Optimize by NOT selecting result_json which can be very large
      const { data, error } = await supabase
        .from('generated_questions')
        .select('id, created_at, input_payload_json, model_used, created_by')
        .eq('created_by', session?.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (id: string, inputPayload: any) => {
    try {
      Swal.fire({
        title: 'Memuat Soal...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const { data, error } = await supabase
        .from('generated_questions')
        .select('result_json')
        .eq('id', id)
        .single();

      if (error) throw error;

      useGeneratorStore.getState().setResult(data.result_json, inputPayload);
      Swal.close();
      navigate('/generator');
    } catch (err) {
      Swal.fire('Error', 'Gagal memuat detail soal.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
      const result = await Swal.fire({
          title: 'Hapus Riwayat?',
          text: "Data yang dihapus tidak dapat dikembalikan.",
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
                  .from('generated_questions')
                  .delete()
                  .eq('id', id);
              
              if (error) throw error;
              
              setHistory(history.filter(item => item.id !== id));
              Swal.fire('Terhapus!', 'Riwayat soal telah dihapus.', 'success');
          } catch (err) {
              Swal.fire('Error', 'Gagal menghapus data.', 'error');
          }
      }
  };

  const groupHistoryByDate = (data: any[]) => {
      const grouped: Record<string, any[]> = {
          'Hari Ini': [],
          'Kemarin': [],
          'Sebelumnya': []
      };

      data.forEach(item => {
          const date = new Date(item.created_at);
          if (isToday(date)) {
              grouped['Hari Ini'].push(item);
          } else if (isYesterday(date)) {
              grouped['Kemarin'].push(item);
          } else {
              grouped['Sebelumnya'].push(item);
          }
      });

      return grouped;
  };

  const groupedHistory = groupHistoryByDate(history);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-royal-blue-600" /></div>;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-hidden font-sans">
        <div className="flex-none px-8 py-8">
            <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <HistoryIcon className="text-royal-blue-600" size={32} />
                        Riwayat Generate Soal
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Pantau dan kelola kembali soal-soal yang telah Anda buat sebelumnya.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 w-64 outline-none transition-all" 
                            placeholder="Cari riwayat..." 
                            type="text"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                        <Filter size={18} />
                        Filter
                    </button>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar">
            <div className="max-w-6xl mx-auto w-full space-y-8">
                {Object.entries(groupedHistory).map(([label, items]) => (
                    items.length > 0 && (
                        <div key={label}>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 pl-1">{label}</h3>
                            <div className="space-y-4">
                                {items.map((item) => (
                                    <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center gap-6">
                                        <div className="flex-none flex flex-col items-center justify-center w-16 text-center border-r border-slate-100 pr-6 md:pr-0 md:border-r-0 md:w-auto md:min-w-[80px]">
                                            <span className="text-2xl font-bold text-slate-900">{format(new Date(item.created_at), 'HH:mm')}</span>
                                            <span className="text-xs font-medium text-slate-400">WIB</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-100 text-green-700 text-xs font-bold border border-green-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                                    Sukses
                                                </span>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                                    {item.input_payload_json?.subject || 'Umum'} - {item.input_payload_json?.class_grade?.split('/')[0]}
                                                </span>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-royal-blue-50 text-royal-blue-700">
                                                    C{item.input_payload_json?.cognitive_level}
                                                </span>
                                            </div>
                                            <h4 className="text-base font-bold text-slate-900 truncate">{item.input_payload_json?.topic}</h4>
                                            <p className="text-sm text-slate-500 mt-1 line-clamp-1">{item.input_payload_json?.learning_objectives}</p>
                                        </div>
                                        <div className="flex-none flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t border-slate-100 md:border-t-0">
                                            <button className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-2 group">
                                                <RefreshCw size={16} className="group-hover:rotate-180 transition-transform" />
                                                Regenerate
                                            </button>
                                            <button 
                                                onClick={() => handleViewDetail(item.id, item.input_payload_json)}
                                                className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-white bg-royal-blue-600 hover:bg-royal-blue-700 rounded-xl transition-colors shadow-lg shadow-royal-blue-600/20 flex items-center justify-center gap-2"
                                            >
                                                Lihat Detail
                                                <ArrowRight size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}

                {history.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <HistoryIcon size={40} className="opacity-20" />
                        </div>
                        <p className="font-medium text-slate-600">Belum ada riwayat soal</p>
                        <p className="text-sm">Mulai buat soal untuk melihat riwayat disini.</p>
                    </div>
                )}

                {history.length > 0 && (
                    <div className="pt-8 flex justify-center pb-10">
                        <button className="px-6 py-3 text-sm font-medium text-slate-500 hover:text-royal-blue-600 transition-colors flex flex-col items-center gap-2">
                            <ChevronDown size={24} />
                            Muat Lebih Banyak
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
