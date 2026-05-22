export function decodeJwt (token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(payload).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to decode JWT', e);
    return null;
  }
}

// helper to dynamically load the Google Identity Services script
export function loadGsiScript () {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    if (window.google && window.google.accounts && window.google.accounts.id) return resolve(window.google);
    const id = 'gsi-client';
    if (document.getElementById(id)) return resolve(window.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.id = id;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}
