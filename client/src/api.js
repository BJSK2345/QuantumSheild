// Thin fetch wrapper around the QuantumShield API (proxied to :3001 by Vite).
async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function get(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => get('/api/health'),
  algorithms: () => get('/api/algorithms'),
  scan: (payload) => post('/api/scan', payload),
  protect: (payload) => post('/api/protect', payload),
  unprotect: (payload) => post('/api/unprotect', payload),
  keys: (types) => post('/api/keys', { types }),
};

// --- File helpers ----------------------------------------------------------
export function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}

export function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || ''); // strip data: prefix
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function downloadText(filename, text) {
  triggerDownload(filename, new Blob([text], { type: 'text/plain' }));
}
export function downloadJSON(filename, obj) {
  triggerDownload(filename, new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
}
export function downloadBase64(filename, b64, mime = 'application/octet-stream') {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  triggerDownload(filename, new Blob([bytes], { type: mime }));
}
function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
