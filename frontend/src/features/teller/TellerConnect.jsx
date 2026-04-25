import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function TellerConnect({ onSuccess }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.teller.io/connect/connect.js';
    script.onload = () => setReady(true);
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  const open = () => {
    if (!window.TellerConnect) return;
    const connect = window.TellerConnect.setup({
      applicationId: import.meta.env.VITE_TELLER_APP_ID,
      onSuccess: async (enrollment) => {
        setLoading(true);
        try {
          await api.post('/teller/enroll', { access_token: enrollment.accessToken });
          if (onSuccess) onSuccess();
        } catch (err) {
          console.error('Teller enroll error:', err);
        } finally {
          setLoading(false);
        }
      },
      onExit: () => {},
    });
    connect.open();
  };

  return (
    <button
      onClick={open}
      disabled={!ready || loading}
      style={{
        width: '100%',
        padding: '9px 0',
        background: loading || !ready ? '#ccc' : '#0d9488',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: !ready || loading ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {loading ? 'Connecting...' : '+ Connect via Teller'}
    </button>
  );
}
