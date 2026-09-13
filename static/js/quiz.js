/* ═══════════════════════════════════════════════════════
   QUIZ.JS — Quiz & Revision page logic
═══════════════════════════════════════════════════════ */

let questions   = [];
let answered    = 0;
let score       = 0;
let currentUnit = '';
let currentUnitName = 'All Units';

function selectUnit(btn) {
  document.querySelectorAll('.unit-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentUnit     = btn.dataset.idx;
  currentUnitName = btn.textContent.trim();
}

async function startQuiz() {
  const topic = document.getElementById('topic').value.trim();

  showLoader('loader');
  document.getElementById('quiz-area').style.display = 'none';
  document.getElementById('startBtn').disabled = true;

  const data = await API.post('/generate_quiz', {
    topic:        topic || currentUnitName,
    difficulty:   document.getElementById('difficulty').value,
    num_questions: document.getElementById('num_q').value,
    unit_index:   currentUnit !== '' ? currentUnit : null
  });

  hideLoader('loader');
  document.getElementById('startBtn').disabled = false;

  if (data.error) { alert('Error: ' + data.error); return; }

  questions = data.questions;
  answered  = 0;
  score     = 0;

  document.getElementById('quiz-title').textContent   = (topic || data.source) + ' Quiz';
  document.getElementById('score-badge').textContent  = `0 / ${questions.length}`;
  document.getElementById('result-section').style.display = 'none';

  renderQuestions(data.unit_name || currentUnitName);
  document.getElementById('quiz-area').style.display = 'block';
  document.getElementById('quiz-area').scrollIntoView({ behavior: 'smooth' });
}

function renderQuestions(unitName) {
  document.getElementById('questions-wrap').innerHTML = questions.map((q, i) => `
    <div class="q-card" id="qcard-${i}">
      <div class="q-number">Question ${i + 1} of ${questions.length}</div>
      <div class="q-text">${q.question}</div>
      <div class="options-wrap">
        ${Object.entries(q.options).map(([k, v]) => `
          <button class="option-btn" id="opt-${i}-${k}"
                  onclick="answer(${i}, '${k}', '${unitName.replace(/'/g, "\\'")}')">
            <span class="option-key">${k}</span> ${v}
          </button>`).join('')}
      </div>
      <div class="explanation-box" id="exp-${i}">💡 ${q.explanation || ''}</div>
    </div>`).join('');
}

async function answer(qi, chosen, unitName) {
  const q       = questions[qi];
  const correct = chosen === q.correct;
  if (correct) score++;
  answered++;

  ['A', 'B', 'C', 'D'].forEach(k => {
    const btn = document.getElementById(`opt-${qi}-${k}`);
    if (!btn) return;
    btn.disabled = true;
    if (k === q.correct)          btn.classList.add('correct');
    else if (k === chosen && !correct) btn.classList.add('wrong');
  });

  const expBox = document.getElementById(`exp-${qi}`);
  if (expBox) expBox.classList.add('show');

  document.getElementById(`qcard-${qi}`).classList.add('answered');
  document.getElementById('score-badge').textContent = `${score} / ${questions.length}`;

  if (answered === questions.length) await showResult(unitName);
}

async function showResult(unitName) {
  const pct   = Math.round(score / questions.length * 100);
  const grade = pct >= 80 ? '🏆 Excellent!' : pct >= 60 ? '👍 Good Job' : '📚 Needs More Study';
  const msg   = pct >= 80
    ? 'Outstanding! You have a solid understanding of this material.'
    : pct >= 60
    ? 'Good effort! Review the questions you got wrong before the exam.'
    : 'Spend more time on this topic. Try again after reviewing the material.';
  const color = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';

  document.getElementById('result-section').innerHTML = `
    <div class="result-card" style="border-color:${color}">
      <div class="score-ring" style="border-color:${color}">
        <div class="snum" style="color:${color}">${pct}%</div>
        <div class="slbl">${score} / ${questions.length}</div>
      </div>
      <h3>${grade}</h3>
      <p>${msg}</p>
      <div class="result-actions">
        <button class="btn btn-primary" onclick="startQuiz()">Try Again →</button>
        <a href="/dashboard" class="btn btn-ghost">← Dashboard</a>
      </div>
    </div>`;

  document.getElementById('result-section').style.display = 'block';
  document.getElementById('result-section').scrollIntoView({ behavior: 'smooth' });

  await API.post('/save_result', {
    unit_name: unitName,
    score,
    total: questions.length
  });
}
