import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { LogOut, History, Settings, PenTool, Bell, User, GraduationCap } from 'lucide-react';
import { cn } from '@/utils/cn';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout() {
  const { profile, signOut } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Apakah Anda yakin?',
      text: "Anda akan keluar dari sesi ini.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb', // Royal Blue 600
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Keluar!',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await signOut();
        navigate('/login');
      } catch (error) {
        console.error("Logout failed:", error);
        // Force navigate even if logout fails
        navigate('/login');
      }
    }
  };

  const navItems = [];

  if (profile?.role === 'admin') {
    navItems.push({ label: 'Halaman Admin', href: '/admin', icon: Settings });
  }

  navItems.push(
    { label: 'Buat Soal', href: '/generator', icon: PenTool },
    { label: 'Proyek Soal', href: '/projects', icon: History },
    { label: 'Bank Soal', href: '/history', icon: History },
    { label: 'Pengaturan', href: '/settings', icon: Settings }
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="flex-none h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-30 shadow-sm sticky top-0">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-royal-blue-600 flex items-center justify-center text-white">
            <GraduationCap size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Pakar Buat Soal</h1>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                  isActive 
                    ? "text-royal-blue-600 bg-royal-blue-50" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {/* <item.icon size={16} /> */}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
           {/* Desktop Profile Display */}
           <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <span className="text-sm font-bold text-slate-900">{profile?.full_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                  {profile?.role || 'user'}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                <LogOut size={16} />
                <span>Keluar</span>
              </button>
           </div>

           {/* Mobile Profile Menu */}
           <div className="md:hidden relative group">
              <button className="size-9 rounded-full bg-royal-blue-100 border border-royal-blue-200 flex items-center justify-center text-royal-blue-700 font-bold overflow-hidden">
                {profile?.full_name?.charAt(0) || <User size={18} />}
              </button>
              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 hidden group-hover:block hover:block z-50">
                 <div className="px-4 py-3 border-b border-slate-50">
                    <p className="text-xs font-bold text-slate-800 truncate">{profile?.full_name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{profile?.email}</p>
                 </div>
                 <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                 >
                   <LogOut size={16} /> Keluar Aplikasi
                 </button>
              </div>
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex">
        <div className="h-full w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
