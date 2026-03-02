import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';
import { Profile } from '@/types';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return; // Prevent multiple initializations
    
    set({ loading: true });
    
    try {
      // Get initial session once
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      set({ session });

      if (session) {
        await get().refreshProfile();
      } else {
        set({ profile: null });
      }

      // Listen for changes once
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ session });
        if (session) {
          // Only refresh profile if session user changed or profile missing
          const currentProfile = get().profile;
          if (!currentProfile || currentProfile.id !== session.user.id) {
              get().refreshProfile();
          }
        } else {
          set({ profile: null });
        }
        set({ loading: false });
      });
      
      set({ loading: false, initialized: true });
    } catch (error) {
      console.error("Auth initialization error:", error);
      set({ loading: false, initialized: true }); // Ensure loading stops even on error
    }
  },

  refreshProfile: async () => {
    const session = get().session;
    if (!session) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      
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
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      set({ session: null, profile: null });
    }
  }
}));
