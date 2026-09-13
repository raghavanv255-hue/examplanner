/* ═══════════════════════════════════════════════════════
   PLANNER.JS — Study Planner page logic
═══════════════════════════════════════════════════════ */

function updateTimeDisplay() {
  const d = parseInt(document.getElementById('days').value) || 0;
  const h = parseInt(document.getElementById('hours').value) || 0;
  const total = (d * 24) + h;
  let label = '';
  if (d > 0 && h > 0) label = `${d}d ${h}h`;
  else if (d > 0) label = `${d} day${d > 1 ? 's' : ''}`;
  else label = `${h}h`;
  document.getElementById('time-display').textContent = label + ' total study time';
}

async function generatePlan() {
  const subject = document.getElementById('subject').value.trim();
  if (!subject) { alert('Please enter a subject or course name.'); return; }

  const days  = parseInt(document.getElementById('days').value) || 0;
  const hours = parseFloat(document.getElementById('hours').value) || 0;
  if ((days * 24 + hours) === 0) { alert('Please enter at least 1 hour of study time.'); return; }

  showLoader('loader');
  document.getElementById('output').style.display = 'none';
  document.getElementById('genBtn').disabled = true;

  const data = await API.post('/generate_plan', {
    subject,
    days,
    hours,
    topics:    document.getElementById('topics').value,
    exam_type: document.getElementById('exam_type').value
  });

  hideLoader('loader');
  document.getElementById('genBtn').disabled = false;

  if (data.error) { alert('Error: ' + data.error); return; }

  renderPlan(data.plan);
  document.getElementById('output').style.display = 'block';
  document.getElementById('output').scrollIntoView({ behavior: 'smooth' });
}

function renderPlan(plan) {
  // Strategy Box
  const priorityMap = { high: 'badge-red', medium: 'badge-gold', low: 'badge-green' };
  const pb = priorityMap[plan.priority_level] || 'badge-purple';
  document.getElementById('strategy-box').innerHTML = `
    <h3>${plan.subject} &nbsp;<span class="badge ${pb}">${(plan.priority_level||'').toUpperCase()} PRIORITY</span></h3>
    <p>${plan.strategy}</p>
    <div class="strat-meta">
      <span class="strat-tag badge-purple">${plan.total_hours}h total planned</span>
    </div>`;

  // Schedule Slots
  document.getElementById('schedule-slots').innerHTML = (plan.schedule || []).map(s => `
    <div class="slot">
      <div>
        <div class="slot-time">${s.time_block}</div>
        <div class="slot-dur">${s.duration_mins} min</div>
      </div>
      <div>
        <div class="slot-topic">${s.topic}</div>
        <div class="slot-activity">${s.activity}</div>
        <div class="slot-tip">${s.tips}</div>
        <span class="slot-why">⚡ ${s.why_important}</span>
      </div>
    </div>`).join('');

  // Checklist
  document.getElementById('checklist').innerHTML = (plan.quick_revision_checklist || []).map(item => `
    <label class="check-item" onclick="this.classList.toggle('checked')">
      <input type="checkbox"> ${item}
    </label>`).join('');

  // Exam Tips
  document.getElementById('exam-tips').innerHTML = (plan.exam_day_tips || []).map(t => `
    <div class="tip-pill">💡 ${t}</div>`).join('');

  // Stress Note
  document.getElementById('stress-note').textContent = '✨  ' + plan.stress_note;
}
