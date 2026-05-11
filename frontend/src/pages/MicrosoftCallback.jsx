import { useEffect } from 'react';

export default function MicrosoftCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const id_token = params.get('id_token');
    const error = params.get('error_description') || params.get('error');
    if (window.opener) {
      window.opener.postMessage(
        { type: 'ms_auth', id_token: id_token || null, error: error || null },
        window.location.origin
      );
    }
    window.close();
  }, []);

  return <div style={{ minHeight: '100vh', background: '#0a0a0a' }} />;
}
