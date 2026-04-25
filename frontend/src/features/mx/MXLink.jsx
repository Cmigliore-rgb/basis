import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function MXLink({ onSuccess }) {
  const [widgetUrl, setWidgetUrl] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const openWidget = async () => {
    setLoading(true);
    try {
      const r = await api.post('/mx/connect_url');
      setWidgetUrl(r.data.url);
      setOpen(true);
    } catch (err) {
      console.error('MX connect error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'mx/connect/memberConnected') {
        setOpen(false);
        if (onSuccess) onSuccess();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess]);

  return (
    <>
      <button
        onClick={openWidget}
        disabled={loading}
        style={{
          width: '100%',
          padding: '9px 0',
          background: loading ? '#ccc' : '#7c3aed',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {loading ? 'Loading...' : '+ Connect via MX'}
      </button>

      {open && widgetUrl && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', width: 480, height: 640, position: 'relative' }}>
            <button
              onClick={() => setOpen(false)}
              style={{ position: 'absolute', top: 10, right: 14, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', zIndex: 1, color: '#6b7280' }}
            >
              &times;
            </button>
            <iframe
              src={widgetUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Connect via MX"
            />
          </div>
        </div>
      )}
    </>
  );
}
