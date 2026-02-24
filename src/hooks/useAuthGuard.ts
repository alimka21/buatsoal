import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const { session, profile, loading, refreshProfile } = useAuthStore();
  return { session, profile, loading, refreshProfile };
}
