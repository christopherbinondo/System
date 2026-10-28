/* Incident AI front-end API layer: direct browser calls, no backend, no keys. */
const AI_URL = 'https://oxford.uk.eu.org/ai/oxford';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
let aiController = null;

// Send a prompt (and optionally one image Blob). Returns the reply text or throws a user-friendly Error.
async function askAI(message, imageBlob) {
  aiController = new AbortController();
  const timer = setTimeout(() => aiController.abort(), 75000);
  try {
    let body, headers = {};
    if (imageBlob) { body = new FormData(); body.append('message', message); body.append('image', imageBlob, 'incident.jpg'); }
    else { headers = { 'Content-Type': 'application/json' }; body = JSON.stringify({ message, max_tokens: 800 }); }
    let res;
    try { res = await fetch(AI_URL, { method: 'POST', headers, body, signal: aiController.signal }); }
    catch (e) {
      console.error('Incident AI fetch failed:', e);
      throw new Error(e.name === 'AbortError' ? 'Request cancelled or timed out.'
        : 'Could not reach Incident AI (' + (e.message || 'network error') + '). Check your internet, turn off any VPN or ad blocker, and try again.');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok) {
      const fb = { 403: 'Available only in the Philippines.', 413: 'Too large. Use a smaller photo or shorter text.', 429: 'Too many requests. Wait a minute.', 502: 'Try again shortly.', 503: 'Try again shortly.' };
      console.error('Incident AI error', res.status, data);
      throw new Error((data.error || fb[res.status] || 'Incident AI request failed.') + (data.detail ? ' ' + data.detail : '') + ' (HTTP ' + res.status + ')');
    }
    return String(data.reply || '');
  } finally { clearTimeout(timer); aiController = null; }
}

function extractJson(text) {
  const t = String(text).replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch (e2) { return null; }
}

// Resize in the browser (canvas) and export as JPEG
function shrink(file, maxSide, quality) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => (b ? ok(b) : bad(new Error('The photo could not be prepared.'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error('This photo could not be read. Use a JPEG, PNG, GIF or WebP image.')); };
    img.src = url;
  });
}
const blobToDataURL = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
document.querySelectorAll('.ai-cancel').forEach(b => b.addEventListener('click', () => { if (aiController) aiController.abort(); }));