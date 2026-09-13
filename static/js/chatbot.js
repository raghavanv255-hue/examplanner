/* ═══════════════════════════════════════════════════════
   CHATBOT.JS — AI Chatbot page logic
═══════════════════════════════════════════════════════ */

let currentFormat = 'detailed';

function setFormat(btn) {
  document.querySelectorAll('.sb-btn[data-fmt]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFormat = btn.dataset.fmt;
}

function useChip(el) {
  const es = document.getElementById('empty-state');
  if (es) es.remove();
  document.getElementById('qInput').value = el.textContent.trim();
  sendMessage();
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function addMessage(role, content, source) {
  const wrap = document.getElementById('messages');
  const es = document.getElementById('empty-state');
  if (es) es.remove();
  const div = document.createElement('div');
  div.className = `msg ${role} fade-in`;
  const src = (role === 'assistant' && source)
    ? `<div class="msg-src">📄 ${source}</div>` : '';
  div.innerHTML = `<div class="msg-bubble">${formatText(content)}</div>${src}`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function showTyping() {
  const wrap = document.getElementById('messages');
  const t = document.createElement('div');
  t.id = 'typing';
  t.className = 'typing-indicator fade-in';
  t.innerHTML = '<span></span><span></span><span></span>';
  wrap.appendChild(t);
  wrap.scrollTop = wrap.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

async function sendMessage() {
  const input = document.getElementById('qInput');
  const q = input.value.trim();
  if (!q) return;

  addMessage('user', q);
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('sendBtn').disabled = true;
  showTyping();

  const unitSel = document.getElementById('unit-select');
  const unitIdx = unitSel && unitSel.value !== '' ? unitSel.value : null;

  const data = await API.post('/ask', {
    question: q,
    format: currentFormat,
    unit_index: unitIdx
  });

  removeTyping();
  document.getElementById('sendBtn').disabled = false;

  if (data.error) { addMessage('assistant', '⚠ ' + data.error); return; }
  addMessage('assistant', data.answer, data.source);
}

async function docAction(mode) {
  showTyping();
  const unitSel = document.getElementById('unit-select');
  const unitIdx = unitSel && unitSel.value !== '' ? parseInt(unitSel.value) : null;

  const data = await API.post('/doc_action', { mode, unit_index: unitIdx });
  removeTyping();

  if (data.error) { addMessage('assistant', '⚠ ' + data.error); return; }
  const labels = {
    overview:   '📄 Document Overview',
    key_points: '🎯 Key Points',
    exam_focus: '🔥 Exam Focus'
  };
  addMessage('assistant', `**${labels[mode]}**\n\n${data.result}`, data.source);
}

async function clearHistory() {
  if (!confirm('Clear all chat history?')) return;
  await API.post('/clear_chat', {});
  location.reload();
}
