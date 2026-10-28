/* ===== Data structures (hand-built, no Array.sort / Array.find) ===== */

class Node { constructor(data) { this.data = data; this.next = null; } }

// Linked List: master record of every incident
class LinkedList {
  constructor() { this.head = null; this.tail = null; this.size = 0; }
  add(data) {
    const n = new Node(data);
    if (!this.head) this.head = this.tail = n;
    else { this.tail.next = n; this.tail = n; }
    this.size++;
  }
  search(test) {
    const out = [];
    for (let c = this.head; c; c = c.next) if (test(c.data)) out.push(c.data);
    return out;
  }
  findById(id) {
    for (let c = this.head; c; c = c.next) if (c.data.id === id) return c.data;
    return null;
  }
  toArray() { return this.search(() => true); }
}

// Queue (FIFO)
class Queue {
  constructor() { this.head = null; this.tail = null; this.size = 0; }
  enqueue(data) {
    const n = new Node(data);
    if (this.tail) this.tail.next = n; else this.head = n;
    this.tail = n; this.size++;
  }
  dequeue() {
    if (!this.head) return null;
    const d = this.head.data;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this.size--;
    return d;
  }
  remove(id) {
    let prev = null;
    for (let c = this.head; c; prev = c, c = c.next) {
      if (c.data.id !== id) continue;
      if (prev) prev.next = c.next; else this.head = c.next;
      if (c === this.tail) this.tail = prev;
      this.size--; return true;
    }
    return false;
  }
  toArray() { const a = []; for (let c = this.head; c; c = c.next) a.push(c.data); return a; }
}

// Stack (LIFO)
class Stack {
  constructor() { this.top = null; this.size = 0; }
  push(data) { const n = new Node(data); n.next = this.top; this.top = n; this.size++; }
  pop() { if (!this.top) return null; const d = this.top.data; this.top = this.top.next; this.size--; return d; }
  toArray() { const a = []; for (let c = this.top; c; c = c.next) a.push(c.data); return a; }
}

function insertionSort(arr, cmp) {
  const a = arr.slice();
  for (let i = 1; i < a.length; i++) {
    const key = a[i]; let j = i - 1;
    while (j >= 0 && cmp(a[j], key) > 0) { a[j + 1] = a[j]; j--; }
    a[j + 1] = key;
  }
  return a;
}

/* ===== Application ===== */

const CATEGORIES = ['Accident', 'Lost ID', 'Damaged Facility', 'Request for Assistance', 'Other'];
const STATUSES = ['Pending', 'In Progress', 'Resolved'];
const RANK = { 'Pending': 0, 'In Progress': 1, 'Resolved': 2 };

const records = new LinkedList();
const urgentQ = new Queue();
const regularQ = new Queue();
const history = new Stack();
let counter = 0, view = 'all', found = null;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qFor = r => (r.urgent ? urgentQ : regularQ);
const fmt = t => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function save() {
  try {
    localStorage.setItem('incident-desk', JSON.stringify({
      counter, reports: records.toArray(), history: history.toArray().reverse()
    }));
  } catch (e) { window.storageError = true; }
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('incident-desk'));
    if (!d) return;
    counter = d.counter;
    d.reports.forEach(r => { records.add(r); if (r.status === 'Pending') qFor(r).enqueue(r); });
    d.history.forEach(h => history.push(h));
  } catch (e) { /* ignore corrupt data */ }
}

function newId() { return 'INC-' + String(++counter).padStart(4, '0'); }

function setStatus(r, to, log = true) {
  const from = r.status;
  if (from === to) return;
  urgentQ.remove(r.id); regularQ.remove(r.id);
  r.status = to;
  if (to === 'Pending') qFor(r).enqueue(r);
  if (log) history.push({ id: r.id, from, to, time: Date.now() });
  save(); render();
}

/* ===== Shared page helpers ===== */
const PAGES = [
  ['index.html', 'Dashboard', 'layout-dashboard'],
  ['report.html', 'Report an incident', 'plus-circle'],
  ['queue.html', 'Processing queue', 'list-ordered'],
  ['records.html', 'Incident records', 'archive']
];

function render() { if (typeof pageRender === 'function') pageRender(); }

function addReport(f) {
  const r = { id: newId(), reporter: f.reporter, category: f.category, location: f.location, description: f.description,
    urgent: f.urgent, status: 'Pending', created: Date.now(), image: f.image || '', aiDescription: f.aiDescription || '' };
  records.add(r); qFor(r).enqueue(r); save();
  if (window.storageError) { window.storageError = false; r.image = ''; r.imageDropped = true; save(); window.storageError = false; }
  render(); return r;
}
function processNext() { const r = urgentQ.dequeue() || regularQ.dequeue(); if (r) setStatus(r, 'In Progress'); return r; }
function undoLast() { const h = history.pop(); if (!h) return null; setStatus(records.findById(h.id), h.from, false); return h; }

/* ===== Clearing incidents ===== */
function resetList(l) { l.head = l.tail = null; l.size = 0; }

function clearResolved() {
  const keep = records.toArray().filter(r => r.status !== 'Resolved');
  const ids = new Set(keep.map(r => r.id));
  const keepHist = history.toArray().filter(h => ids.has(h.id)).reverse();
  resetList(records); keep.forEach(r => records.add(r));
  history.top = null; history.size = 0; keepHist.forEach(h => history.push(h));
  save(); render();
}

function clearAll() {
  resetList(records); resetList(urgentQ); resetList(regularQ);
  history.top = null; history.size = 0; counter = 0;
  try { localStorage.removeItem('incident-desk'); } catch (e) { /* ignore */ }
  render();
}

function deleteReport(id) {
  if (!records.findById(id)) return false;
  const keep = records.toArray().filter(r => r.id !== id);
  const keepHist = history.toArray().filter(h => h.id !== id).reverse();
  resetList(records); keep.forEach(r => records.add(r));
  urgentQ.remove(id); regularQ.remove(id);
  history.top = null; history.size = 0; keepHist.forEach(h => history.push(h));
  save(); render(); return true;
}

function fillStats() {
  const a = records.toArray(), set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('sTotal', a.length);
  set('sWait', a.filter(r => r.status === 'Pending').length);
  set('sProg', a.filter(r => r.status === 'In Progress').length);
  set('sDone', a.filter(r => r.status === 'Resolved').length);
}
function showAlert() {
  const e = $('alert'), u = urgentQ.toArray(); if (!e) return;
  e.hidden = u.length === 0;
  if (u.length) e.textContent = u.length + ' urgent report' + (u.length > 1 ? 's' : '') + ' waiting. Oldest: ' + u[0].id + ' at ' + u[0].location + '. Open the Processing queue.';
}
const pill = r => '<span class="pill st-' + r.status.replace(' ', '') + '">' + r.status + '</span>';
const tagU = r => (r.urgent ? '<span class="tag"><i data-lucide="alert-triangle"></i>Urgent</span>' : '');

/* ===== Sidebar shell (SVG LOGO) ===== */
(function buildShell() {
  const here = location.pathname.split('/').pop() || 'index.html';
  
  // Inline SVG Logo: Shield + Alert Bell + Clipboard
  const logoSvg = `
    <svg class="mark" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 2Z" fill="var(--red)" fill-opacity="0.15" stroke="var(--red)" stroke-width="2" stroke-linejoin="round"/>
      <path d="M12 8V12" stroke="var(--red)" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="16" r="1.5" fill="var(--red)"/>
      <rect x="15" y="12" width="5" height="7" rx="1" fill="var(--primary)" />
      <path d="M16 14H19" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 16H18" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;

  document.body.insertAdjacentHTML('afterbegin',
    '<aside class="side">' +
      '<div class="logo">' + logoSvg + '<div><strong>Incident Desk</strong><small>Emergency assistance</small></div></div>' +
      '<nav>' +
        PAGES.map(p => '<a href="' + p[0] + '"' + (p[0] === here ? ' class="on" aria-current="page"' : '') + '><i data-lucide="' + p[2] + '"></i>' + p[1] + '</a>').join('') +
      '</nav>' +
      '<div class="sos"><strong><i data-lucide="phone-call"></i>In an emergency</strong><p>Call <b>911</b> or tell the nearest staff member first. This system records reports; it does not replace a call for help.</p></div>' +
    '</aside>');
})();

/* ===== Theme Switch Toggle (Top Right) ===== */
(function themeInit() {
  const KEY = 'incident-desk-theme';
  const root = document.documentElement;

  function apply(t) {
    if (t === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }

  // Initial: saved preference -> OS preference -> light
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  const osDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  apply(saved || (osDark ? 'dark' : 'light'));

  // Create the new switch toggle
  const wrapper = document.createElement('div');
  wrapper.className = 'theme-switch-wrapper';
  wrapper.innerHTML = `
    <label class="theme-switch" title="Toggle Dark Mode">
      <input type="checkbox" id="themeCheckbox" ${root.getAttribute('data-theme') === 'dark' ? 'checked' : ''}>
      <span class="slider">
        <i data-lucide="moon" class="icon moon"></i>
        <i data-lucide="sun" class="icon sun"></i>
      </span>
    </label>
  `;
  document.body.appendChild(wrapper);

  const checkbox = document.getElementById('themeCheckbox');
  checkbox.addEventListener('change', () => {
    const next = checkbox.checked ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });

  if (window.lucide) lucide.createIcons();
})();

load();
const todayEl = $('today');
if (todayEl) todayEl.textContent = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

/* ===== Shared UI utilities ===== */
function refreshIcons() { if (window.lucide) lucide.createIcons(); }

(function observeReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
})();

window.addEventListener('load', refreshIcons);