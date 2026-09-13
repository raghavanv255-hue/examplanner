/* ═══════════════════════════════════════════════════════
   GLOBAL.JS — Shared utilities across all pages
   ExamEdge
═══════════════════════════════════════════════════════ */

// ── API Helper ────────────────────────────────────────
const API = {
  post: async (url, data) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  upload: async (url, formData) => {
    const res = await fetch(url, { method: 'POST', body: formData });
    return res.json();
  }
};

// ── Loader helpers ─────────────────────────────────────
function showLoader(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}
function hideLoader(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

// ── Format AI text (markdown to HTML) ─────────────────
function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s(.+)/gm, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ── Navbar scroll effect ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    });
  }
});

// ── Mobile nav toggle ──────────────────────────────────
function toggleNav() {
  const nav = document.getElementById('navMobile');
  if (nav) nav.classList.toggle('open');
}

// ── Upload Modal logic ─────────────────────────────────
let selectedFiles = [];

function openModal() {
  document.getElementById('overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('show');
  resetModal();
}

function resetModal() {
  selectedFiles = [];
  const set = (id, prop, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (prop === 'text') el.textContent = val;
    else if (prop === 'html') el.innerHTML = val;
    else if (prop === 'display') el.style.display = val;
    else if (prop === 'width') el.style.width = val;
    else if (prop === 'disabled') el.disabled = val;
    else if (prop === 'value') el.value = val;
  };
  set('dz-text', 'text', 'Click or drag & drop your PDFs here');
  set('file-list', 'display', 'none');
  set('file-names', 'html', '');
  set('uploadBtn', 'disabled', true);
  set('uploadBtn', 'text', 'Upload & Index');
  set('pbar', 'display', 'none');
  set('pfill', 'width', '0');
  set('upload-status', 'display', 'none');
  set('pdfInput', 'value', '');
}

function handleFileSelect(input) {
  const files = Array.from(input.files);
  if (files.length) setFiles(files);
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
  if (!files.length) { alert('Please drop PDF files only.'); return; }
  setFiles(files);
}

function setFiles(files) {
  selectedFiles = files;
  const list = document.getElementById('file-names');
  if (list) {
    list.innerHTML = files.map(f =>
      `<li><span>📄 ${f.name}</span><span class="fsize">${(f.size / 1024).toFixed(0)} KB</span></li>`
    ).join('');
    list.style.display = 'block';
  }
  const dt = document.getElementById('dz-text');
  if (dt) dt.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
  const btn = document.getElementById('uploadBtn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = `Upload ${files.length} File${files.length > 1 ? 's' : ''} & Index`;
  }
}

async function doUpload() {
  if (!selectedFiles.length) return;
  const pfill  = document.getElementById('pfill');
  const pbar   = document.getElementById('pbar');
  const status = document.getElementById('upload-status');
  const btn    = document.getElementById('uploadBtn');

  pbar.style.display = 'block';
  if (status) status.style.display = 'block';
  pfill.style.width = '20%';
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  const fd = new FormData();
  selectedFiles.forEach(f => fd.append('pdf', f));
  pfill.style.width = '60%';

  try {
    const data = await API.upload('/upload_pdf', fd);
    pfill.style.width = '100%';
    if (data.error) {
      alert('Error: ' + data.error);
      pbar.style.display = 'none';
      if (status) status.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Upload & Index';
      return;
    }
    if (status) {
      status.textContent = `✓ ${data.units.length} unit${data.units.length > 1 ? 's' : ''} indexed!`;
      status.style.color = 'var(--green)';
    }
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    alert('Upload failed: ' + err.message);
    pbar.style.display = 'none';
    btn.disabled = false;
  }
}

// Close overlay on outside click
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
});
