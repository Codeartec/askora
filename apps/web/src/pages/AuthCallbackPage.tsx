import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loadUser, setAuth } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      localStorage.setItem('askora_token', token);
      loadUser().then(() => navigate('/dashboard'));
    } else {
      navigate('/login');
    }
  }, []);

  return <div className="flex items-center justify-center min-h-[60vh]"><p>Authenticating...</p></div>;
}
