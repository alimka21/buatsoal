import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function useFirstLogin() {
  const { profile, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile?.must_change_password) {
      navigate('/first-login');
    }
  }, [profile, loading, navigate]);
}
