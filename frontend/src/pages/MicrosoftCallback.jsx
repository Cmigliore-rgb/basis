import { useEffect } from 'react';
import api from '../services/api';

export default function MicrosoftCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const id_token = params.get('id_token');
    const error = params.get('error_description') || params.get('error');

    if (error) {
      window.location.href = `/login?ms_error=${encodeURIComponent(error)}`;
      return;
    }
    if (!id_token) {
      window.location.href = '/login?ms_error=No+token+received';
      return;
    }

    api.post('/auth/microsoft', { id_token })
      .then(({ data }) => {
        localStorage.setItem('pl_token', data.token);
        window.location.href = '/app';
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Microsoft sign-in failed';
        window.location.href = `/login?ms_error=${encodeURIComponent(msg)}`;
      });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>Signing in...</div>
    </div>
  );
}
