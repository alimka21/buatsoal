import { useState, useEffect } from 'react';
import { Key, Info, CheckCircle, AlertCircle, Trash2, Edit2, Save } from 'lucide-react';
import Swal from 'sweetalert2';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);

  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key');
    if (key) {
      setStoredKey(key);
      setApiKey(key);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      Swal.fire('Error', 'API Key tidak boleh kosong', 'error');
      return;
    }
    localStorage.setItem('gemini_api_key', apiKey.trim());
    setStoredKey(apiKey.trim());
    setIsEditing(false);
    Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      text: 'API Key berhasil disimpan',
      timer: 1500,
      showConfirmButton: false
    });
  };

  const handleDelete = () => {
    Swal.fire({
      title: 'Hapus API Key?',
      text: "Anda akan menggunakan API Key bawaan sistem.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('gemini_api_key');
        setStoredKey(null);
        setApiKey('');
        Swal.fire(
          'Dihapus!',
          'API Key pribadi telah dihapus.',
          'success'
        );
      }
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Key className="text-purple-600" size={28} />
          <h1 className="text-2xl font-bold text-slate-900">Manajemen API Key Gemini</h1>
        </div>
        <p className="text-slate-500">Kelola API Key untuk AI Module Generator</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
        <div className="flex gap-4">
          <div className="mt-1">
            <Info className="text-blue-600" size={24} />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-blue-900 text-lg">Bagaimana Sistem API Key Bekerja?</h3>
            <ul className="list-disc pl-5 text-blue-800 space-y-1 text-sm">
              <li>Aplikasi memiliki API Key <strong>bawaan</strong> (server bersama) untuk semua pengguna</li>
              <li>Anda bisa menggunakan <strong>API Key pribadi</strong> Anda sendiri untuk kuota unlimited</li>
              <li>Prioritas: Jika ada API Key pribadi yang valid, sistem menggunakan itu terlebih dahulu</li>
              <li>Jika API Key pribadi habis atau dihapus, sistem otomatis kembali ke API Key bawaan</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={`border rounded-2xl p-6 ${storedKey ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3 mb-4">
          {storedKey ? (
            <CheckCircle className="text-emerald-600" size={28} />
          ) : (
            <div className="w-7 h-7 rounded-full border-2 border-slate-400 flex items-center justify-center">
              <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
            </div>
          )}
          <h3 className={`text-xl font-bold ${storedKey ? 'text-emerald-900' : 'text-slate-700'}`}>
            {storedKey ? 'API Key Valid & Siap Digunakan' : 'Belum ada API Key Pribadi'}
          </h3>
        </div>
        <div className="ml-10 space-y-1 text-sm">
          <p className={storedKey ? 'text-emerald-800' : 'text-slate-600'}>
            <span className="font-semibold">Sumber:</span> {storedKey ? '🔐 API Key Pribadi Anda' : '🏢 API Key Bawaan Sistem'}
          </p>
          <p className={storedKey ? 'text-emerald-800' : 'text-slate-600'}>
            <span className="font-semibold">Tersimpan:</span> {storedKey ? 'Ya (di Local Storage)' : 'Tidak'}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4">API Key Pribadi Anda</h3>
        <p className="text-slate-500 text-sm mb-6">API Key Anda tersimpan di browser. Ditampilkan sebagian untuk keamanan:</p>

        <div className="mb-6">
          {isEditing || !storedKey ? (
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste Gemini API Key Anda disini (dimulai dengan AIza...)"
              className="w-full p-4 border border-slate-300 rounded-xl font-mono text-slate-700 focus:ring-2 focus:ring-royal-blue-500 focus:border-royal-blue-500 outline-none transition-all"
            />
          ) : (
            <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-600">
              {storedKey.substring(0, 8)}...{storedKey.substring(storedKey.length - 8)}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {isEditing || !storedKey ? (
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} /> Simpan API Key
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 py-3 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 size={18} /> Ubah API Key
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Hapus API Key
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6">
        <div className="flex gap-4">
          <div className="mt-1">
            <Info className="text-purple-600" size={24} />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-purple-900 text-lg">Tips:</h3>
            <ul className="list-disc pl-5 text-purple-800 space-y-1 text-sm">
              <li>Dapatkan API Key gratis di: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline font-semibold hover:text-purple-950">aistudio.google.com/apikey</a></li>
              <li>Jangan share API Key Anda dengan orang lain</li>
              <li>Satu API Key bisa digunakan untuk multiple project</li>
              <li>Monitor quota penggunaan di Google Cloud Console</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
