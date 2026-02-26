import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { Loader2, Trash2, Edit, Save, X, Search, UserPlus, Settings as SettingsIcon, Users } from 'lucide-react';
import Swal from 'sweetalert2';

interface UserData {
  id: string;
  full_name: string;
  email: string;
  role: string;
  question_count: number;
  password_text?: string; // Virtual field for display/editing
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserData>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ full_name: '', email: '', password: '' });
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [subscriptionLink, setSubscriptionLink] = useState('https://s.id/alimkadigital');

  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
    checkCurrentUserRole();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'subscription_link')
        .maybeSingle();
      
      if (data && !error) {
        setSubscriptionLink(data.value);
      } else {
        const localLink = localStorage.getItem('subscription_link');
        if (localLink) setSubscriptionLink(localLink);
      }
    } catch (err) {
      // Ignore
    }
  };

  const saveSettings = async () => {
    try {
      // Try to save to Supabase
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'subscription_link', value: subscriptionLink }, { onConflict: 'key' });
      
      if (error) {
        console.warn("Could not save to DB, saving to localStorage instead", error);
      }
      
      // Always save to localStorage as fallback
      localStorage.setItem('subscription_link', subscriptionLink);
      
      Swal.fire('Berhasil', 'Pengaturan berhasil disimpan', 'success');
    } catch (err: any) {
      localStorage.setItem('subscription_link', subscriptionLink);
      Swal.fire('Berhasil', 'Pengaturan disimpan secara lokal (Database belum mendukung)', 'success');
    }
  };

  const checkCurrentUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single();
      setDebugInfo({ authEmail: user.email, profileRole: profile?.role, profileEmail: profile?.email });
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // 2. Fetch question counts
      const { data: questions, error: questionsError } = await supabase
        .from('generated_questions')
        .select('created_by');

      if (questionsError) throw questionsError;

      // Count questions per user
      const questionCounts: Record<string, number> = {};
      questions?.forEach((q) => {
        questionCounts[q.created_by] = (questionCounts[q.created_by] || 0) + 1;
      });

      // Merge data
      const formattedUsers: UserData[] = profiles.map((profile) => ({
        id: profile.id,
        full_name: profile.full_name || 'No Name',
        email: profile.email || '',
        role: profile.role || 'user',
        question_count: questionCounts[profile.id] || 0,
        password_text: profile.password_text || '******', // Use actual password_text if available
      }));

      setUsers(formattedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserData) => {
    setEditingId(user.id);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      password_text: user.password_text, // Pre-fill with existing password text
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (id: string) => {
    try {
      // 1. Update profile
      const updates: any = {
        full_name: editForm.full_name,
        password_text: editForm.password_text, // Update the password text record
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id);

      if (profileError) throw profileError;

      // 2. Update password if provided
      if (editForm.password_text && editForm.password_text !== users.find(u => u.id === id)?.password_text) {
        // Since we are in a client-side only environment, we cannot update another user's password directly via Admin API.
        // We will just show a success message for the profile update and a warning for the password.
        
        Swal.fire({
            icon: 'success',
            title: 'Data Updated',
            text: 'Profile data and password record updated. Note: The actual login password was NOT changed in Auth (requires server access).'
        });
      } else {
          Swal.fire('Success', 'User updated successfully', 'success');
      }

      setEditingId(null);
      fetchUsers();
    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This will delete the user profile. (Note: Auth user deletion requires server access)",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete!'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setUsers(users.filter(u => u.id !== id));
        Swal.fire('Deleted!', 'User profile has been deleted.', 'success');
      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.email || !newUserForm.password || !newUserForm.full_name) {
      Swal.fire('Error', 'Please fill in all fields', 'error');
      return;
    }

    try {
      // 1. Sign up the user (this will create auth user and profile via trigger if set up, or we manually create profile)
      // Note: In a real admin panel, we'd use service role key to create user without signing in.
      // Here, we can't easily create an auth user without logging out the admin.
      // So we will simulate it by creating a profile entry, but warn about Auth limitation.
      
      const { data, error } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: newUserForm.password,
        options: {
          data: {
            full_name: newUserForm.full_name,
            role: 'user'
          }
        }
      });

      if (error) throw error;

      if (data.user) {
         // Upsert profile to avoid duplicates
         const { error: upsertError } = await supabase.from('profiles').upsert({
             id: data.user.id,
             email: newUserForm.email,
             full_name: newUserForm.full_name,
             role: 'user',
             password_text: newUserForm.password
         }, { onConflict: 'id' });

         if (upsertError) {
             console.error("Error upserting profile:", upsertError);
             Swal.fire('Warning', 'User created in Auth, but failed to create profile: ' + upsertError.message, 'warning');
         } else {
             Swal.fire('Success', 'User created successfully! (Note: You might need to verify email if enabled)', 'success');
         }

         setIsAddingUser(false);
         setNewUserForm({ full_name: '', email: '', password: '' });
         fetchUsers();
      }

    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-royal-blue-600" /></div>;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-hidden font-sans">
      <div className="flex-none px-8 py-8">
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Halaman Admin</h2>
              <p className="text-sm text-slate-500 mt-1">Kelola data pengguna dan pengaturan aplikasi.</p>
            </div>
          </div>
          
          <div className="flex gap-4 border-b border-slate-200">
            <button 
              onClick={() => setActiveTab('users')}
              className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'border-royal-blue-600 text-royal-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={18} />
              Manajemen Pengguna
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-royal-blue-600 text-royal-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <SettingsIcon size={18} />
              Pengaturan Aplikasi
            </button>
          </div>
          
          {activeTab === 'users' && (
            <div className="flex justify-between items-center">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                    type="text" 
                    placeholder="Cari pengguna..." 
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
              <button 
                onClick={() => setIsAddingUser(true)}
                className="px-4 py-2 bg-royal-blue-600 hover:bg-royal-blue-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <UserPlus size={18} />
                Tambah User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">Tambah Pengguna Baru</h3>
              <button onClick={() => setIsAddingUser(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none"
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({...newUserForm, full_name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setIsAddingUser(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleAddUser}
                  className="flex-1 py-2.5 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-medium rounded-xl transition-colors"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar">
        <div className="max-w-6xl mx-auto w-full">
          {activeTab === 'settings' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Pengaturan Umum</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Link Langganan (Halaman Login)</label>
                  <input 
                    type="url" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none"
                    value={subscriptionLink}
                    onChange={(e) => setSubscriptionLink(e.target.value)}
                    placeholder="https://s.id/alimkadigital"
                  />
                  <p className="text-xs text-slate-500 mt-1">Link ini akan digunakan pada tombol "Langganan Pakar Buat Soal" di halaman login.</p>
                </div>
                <div className="pt-4">
                  <button 
                    onClick={saveSettings}
                    className="px-6 py-2.5 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Save size={18} />
                    Simpan Pengaturan
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-16">No</th>
                <th className="px-6 py-4">Nama Akun</th>
                <th className="px-6 py-4 text-center">Jumlah Bikin Soal</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Password Text</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user, index) => (
                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 text-slate-500">{index + 1}</td>
                  
                  {/* Name Column */}
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {editingId === user.id ? (
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none"
                        value={editForm.full_name || ''}
                        onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                      />
                    ) : (
                      user.full_name
                    )}
                  </td>

                  {/* Question Count */}
                  <td className="px-6 py-4 text-center">
                    <span className="bg-royal-blue-50 text-royal-blue-700 px-3 py-1 rounded-full font-bold text-xs">
                      {user.question_count} Soal
                    </span>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-4 text-slate-600">
                    {user.email}
                  </td>

                  {/* Password Text */}
                  <td className="px-6 py-4 text-slate-400 font-mono">
                    {editingId === user.id ? (
                      <input 
                        type="text" 
                        placeholder="Ubah Password"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none"
                        value={editForm.password_text || ''}
                        onChange={(e) => setEditForm({...editForm, password_text: e.target.value})}
                      />
                    ) : (
                      '******'
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editingId === user.id ? (
                        <>
                          <button 
                            onClick={() => handleSave(user.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Simpan"
                          >
                            <Save size={18} />
                          </button>
                          <button 
                            onClick={handleCancelEdit}
                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Batal"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleEdit(user)}
                            className="p-2 text-royal-blue-600 hover:bg-royal-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                  <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                          Tidak ada data pengguna ditemukan.
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
