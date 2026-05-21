import React, { useEffect, useRef } from 'react';
import { loadGsiScript } from '../utils/googleAuth';

export default function GoogleSignInButton({ clientId, onSuccess, onError, buttonId = 'gsi-button' }) {
  const divRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGsiScript();
        if (cancelled) return;
        if (!google || !google.accounts || !google.accounts.id) {
          onError && onError(new Error('Google Identity Services not available'));
          return;
        }

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => {
            onSuccess && onSuccess(res.credential);
          }
        });

        // render the button into our div
        if (divRef.current) {
          google.accounts.id.renderButton(divRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320
          });
        }

      } catch (e) {
        console.error('Google Sign-in load error', e);
        onError && onError(e);
      }
    })();

    return () => { cancelled = true; };
  }, [clientId, onSuccess, onError]);

  return <div id={buttonId} ref={divRef} />;
}
