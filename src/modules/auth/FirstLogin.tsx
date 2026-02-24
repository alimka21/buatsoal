import { useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

const firstLoginSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FirstLoginForm = z.infer<typeof firstLoginSchema>;

export default function FirstLogin() {
  const navigate = useNavigate();
  const { session, refreshProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FirstLoginForm>({
    resolver: zodResolver(firstLoginSchema),
  });

  const onSubmit = async (data: FirstLoginForm) => {
    if (!session) return;
    setIsLoading(true);

    try {
      // 1. Update Password in Auth
      const { error: pwError } = await supabase.auth.updateUser({
        password: data.newPassword
      });
      if (pwError) throw pwError;

      // 2. Update Profile (name, password_text, must_change_password)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          password_text: data.newPassword, // Mirroring as requested
          must_change_password: false
        })
        .eq('id', session.user.id);

      if (profileError) throw profileError;

      await refreshProfile();
      
      Swal.fire({
        icon: 'success',
        title: 'Account Setup Complete',
        text: 'Welcome aboard! Redirecting to dashboard...',
        timer: 2000,
        showConfirmButton: false
      });

      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Setup Failed',
        text: err.message || 'Failed to update profile',
        confirmButtonColor: '#2563eb',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-slate-900 tracking-tight">Welcome!</h2>
          <p className="mt-2 text-sm text-slate-600">Please set up your account to continue.</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent sm:text-sm transition-all duration-200"
                {...register('fullName')}
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent sm:text-sm transition-all duration-200"
                {...register('newPassword')}
              />
              {errors.newPassword && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.newPassword.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <input
                type="password"
                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent sm:text-sm transition-all duration-200"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-royal-blue-600 hover:bg-royal-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-royal-blue-500 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
