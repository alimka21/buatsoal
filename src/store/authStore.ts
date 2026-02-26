import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';
import { Profile } from '@/types';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,

  initialize: async () => {
    set({ loading: true });
    
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    set({ session });

    if (session) {
      await get().refreshProfile();
    } else {
      set({ profile: null });
    }

    // Listen for changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) {
        get().refreshProfile();
      } else {
        set({ profile: null });
      }
      set({ loading: false });
    });
    
    set({ loading: false });
  },

  refreshProfile: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      
      console.log("Auth UID:", session.user.id);
      console.log("Profile raw data:", data);
      console.log("Profile error:", error);

      if (error) {
         console.log("Profile fetch error:", error);
      }

      if (!error && data) {
        set({ profile: data as Profile });
      } else {
        set({ profile: null });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  }
}));
