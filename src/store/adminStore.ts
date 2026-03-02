import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';

interface AdminState {
  users: any[];
  logs: any[];
  loading: boolean;
  fetchData: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  users: [],
  logs: [],
  loading: false,

  fetchData: async () => {
    set({ loading: true });
    try {
      const { data: usersData, error: usersError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (usersError) throw usersError;

      const { data: logsData, error: logsError } = await supabase.from('activity_log').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50);
      if (logsError) throw logsError;
      
      set({ users: usersData || [], logs: logsData || [], loading: false });
    } catch (error) {
      console.error("Admin fetch error:", error);
      set({ loading: false });
    }
  }
}));
