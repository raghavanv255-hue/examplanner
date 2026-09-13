/* ═══════════════════════════════════════════════════════
   DASHBOARD.JS — Dashboard page logic
═══════════════════════════════════════════════════════ */

async function clearDocs() {
  if (!confirm('Clear all uploaded documents? This cannot be undone.')) return;
  await fetch('/clear_docs', { method: 'POST' });
  location.reload();
}
