import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, GraduationCap, Mail, Lock, Eye, EyeOff, Facebook, Instagram, ExternalLink, CreditCard } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import Swal from 'sweetalert2';

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [subscriptionLink, setSubscriptionLink] = useState('https://s.id/alimkadigital');
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  useEffect(() => {
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
          // Fallback to local storage if DB table doesn't exist yet
          const localLink = localStorage.getItem('subscription_link');
          if (localLink) setSubscriptionLink(localLink);
        }
      } catch (err) {
        // Ignore errors if table doesn't exist
      }
    };
    fetchSettings();
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;
      
      // Refresh profile to ensure we have the latest data before redirecting
      await refreshProfile();
      
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      
      Toast.fire({
        icon: 'success',
        title: 'Berhasil masuk'
      });

      navigate('/');
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Masuk',
        text: err.message || 'Periksa kembali email dan password Anda.',
        confirmButtonColor: '#2563eb', // royal-blue-600
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-white">
      {/* Left Side - Blue Theme */}
      <div className="hidden lg:flex w-1/2 bg-slate-800 relative flex-col items-center justify-center p-12 text-white overflow-hidden">
        {/* Background Pattern/Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-royal-blue-900 to-slate-900 opacity-90 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 z-0"></div>
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
          {/* Logo Container */}
          <div className="w-32 h-32 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 border border-white/20 shadow-2xl">
            <GraduationCap size={64} className="text-white" />
          </div>

          <h1 className="text-4xl font-bold mb-2 tracking-tight">PAKAR BUAT SOAL</h1>
          <h2 className="text-4xl font-bold mb-6 tracking-tight">AI GENERATOR</h2>
          
          <p className="text-lg text-blue-100 mb-10 leading-relaxed">
            Platform cerdas terpadu untuk merancang instrumen evaluasi yang komprehensif. Mendukung pembuatan soal Standar Sekolah, AKM (Literasi & Numerasi), TKA, serta tingkat Olimpiade.
          </p>

          <div className="flex items-center gap-4 bg-white/10 px-6 py-3 rounded-full border border-white/10 backdrop-blur-sm">
             <span className="text-sm text-blue-200">Dev by <span className="font-bold text-white">Muhammad Alimka</span></span>
             <div className="h-4 w-px bg-blue-400/30"></div>
             <div className="flex gap-3">
                <a href="https://web.facebook.com/muhammad.alimka/" target="_blank" rel="noopener noreferrer" className="text-blue-200 hover:text-white transition-colors"><Facebook size={18} /></a>
                <a href="https://www.instagram.com/muh.alimka/" target="_blank" rel="noopener noreferrer" className="text-blue-200 hover:text-white transition-colors"><Instagram size={18} /></a>
                <a href="https://www.tiktok.com/@muh.alimka" target="_blank" rel="noopener noreferrer" className="text-blue-200 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music-2"><circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/></svg>
                </a>
             </div>
          </div>

          <a href="https://pakarmodul.vercel.app/auth" target="_blank" rel="noopener noreferrer" className="mt-12 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full shadow-lg shadow-orange-500/30 transition-all transform hover:scale-105 flex items-center gap-2">
            <ExternalLink size={18} />
            Buka Pakar Modul Ajar
          </a>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Masuk Aplikasi</h2>
            <p className="text-slate-500">Gunakan akun yang diberikan oleh Admin.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 transition-all"
                    placeholder="nama@email.com"
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">⚠️ {errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kata Sandi</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="block w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 transition-all"
                    placeholder="••••••••"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">⚠️ {errors.password.message}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-royal-blue-600 hover:bg-royal-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-royal-blue-500 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-royal-blue-600/30 transition-all duration-200 active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Masuk Sekarang'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 text-center space-y-4">
            <p className="text-sm text-slate-500">Belum punya akun?</p>
            <a 
              href={subscriptionLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-3 px-4 border-2 border-royal-blue-100 text-royal-blue-700 bg-royal-blue-50 hover:bg-royal-blue-100 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              Langganan Pakar Buat Soal
            </a>
          </div>
        </div>
        <div className="mt-8 text-center">
             <p className="text-xs text-slate-400">Dev by Muhammad Alimka | 2026</p>
        </div>
      </div>
    </div>
  );
}
