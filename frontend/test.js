/* ============================================================
   test.js — Сократ · Тест тапсыру логикасы
   ============================================================ */

const API_URL = 'http://localhost:3000/api';

// === STATE ===
let questions     = [];
let currentIdx    = 0;
let answers       = [];   // [{ question, correct, studentAnswer, isCorrect }]
let studentName   = '';
let selectedGrade = '8';
let selectedTopic = '';

// === DOM ===
const gradeEl        = document.getElementById('t-grade');
const topicEl        = document.getElementById('t-topic');
const nameEl         = document.getElementById('t-name');
const startBtn       = document.getElementById('start-btn');
const startSpinner   = document.getElementById('start-spinner');
const formErrEl      = document.getElementById('form-err');
const nextBtn        = document.getElementById('next-btn');
const retryBtn       = document.getElementById('retry-btn');

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  loadTopics(gradeEl.value);

  gradeEl.addEventListener('change', () => {
    selectedGrade = gradeEl.value;
    loadTopics(selectedGrade);
  });

  topicEl.addEventListener('change', () => { selectedTopic = topicEl.value; });

  startBtn.addEventListener('click',  startTest);
  nextBtn.addEventListener('click',   nextQuestion);
  retryBtn.addEventListener('click',  retry);

  // Enter в поле имени
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') startTest();
  });
});

// === LOAD TOPICS ===
async function loadTopics(grade) {
  try {
    const res        = await fetch(`${API_URL}/curriculum/${grade}`);
    const { topics } = await res.json();
    topicEl.innerHTML = topics
      .map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`)
      .join('');
    selectedTopic = topics[0] || '';
  } catch (_) {
    topicEl.innerHTML = '<option>Желі қатесі</option>';
  }
}

// === START TEST ===
async function startTest() {
  const name = nameEl.value.trim();
  if (!name) {
    showErr('Аты-жөніңді міндетті түрде жаз!');
    nameEl.focus();
    return;
  }
  hideErr();

  studentName   = name;
  selectedGrade = gradeEl.value;
  selectedTopic = topicEl.value;

  startBtn.disabled = true;
  startSpinner.classList.remove('hidden');

  try {
    const res = await fetch(`${API_URL}/test`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grade: selectedGrade, topic: selectedTopic, count: 10 }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    questions = data.questions || [];

    if (questions.length === 0) {
      showErr('Тест сұрақтары жасалмады. Қайталап байқа.');
      return;
    }

    answers    = [];
    currentIdx = 0;
    showView('view-test');
    renderQuestion();

  } catch (err) {
    showErr(err.name === 'TypeError'
      ? 'Сервермен байланыс жоқ. localhost:3000 қосулы ма?'
      : `Қате: ${err.message}`);
  } finally {
    startBtn.disabled = false;
    startSpinner.classList.add('hidden');
  }
}

// === RENDER QUESTION ===
function renderQuestion() {
  const q     = questions[currentIdx];
  const total = questions.length;

  // Progress
  const pct = Math.round((currentIdx / total) * 100);
  document.getElementById('prog-fill').style.width = pct + '%';
  document.getElementById('prog-label').textContent = `${currentIdx + 1} / ${total} сұрақ`;
  document.getElementById('q-num').textContent  = `СҰРАҚ ${currentIdx + 1}`;
  document.getElementById('q-text').textContent = q.question || '';

  // Answer buttons
  const grid    = document.getElementById('answer-grid');
  grid.innerHTML = '';

  const letters = ['A', 'B', 'C', 'D'];
  const opts    = q.options || {};

  letters.forEach(letter => {
    const text = typeof opts === 'object' && !Array.isArray(opts)
      ? opts[letter]
      : opts[letters.indexOf(letter)];
    if (text === undefined || text === null) return;

    const btn = document.createElement('button');
    btn.type             = 'button';
    btn.className        = 'answer-btn';
    btn.dataset.letter   = letter;
    btn.innerHTML        =
      `<span class="answer-letter">${letter}</span><span>${escHtml(String(text))}</span>`;
    btn.addEventListener('click', () => selectAnswer(letter));
    grid.appendChild(btn);
  });

  nextBtn.disabled    = true;
  nextBtn.textContent = currentIdx === total - 1 ? 'Нәтижені көру →' : 'Келесі сұрақ →';
}

// === SELECT ANSWER ===
function selectAnswer(letter) {
  document.querySelectorAll('.answer-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(`.answer-btn[data-letter="${letter}"]`)?.classList.add('selected');

  const q      = questions[currentIdx];
  answers[currentIdx] = {
    question:      q.question,
    correct:       q.correct,
    studentAnswer: letter,
    isCorrect:     letter === q.correct,
  };
  nextBtn.disabled = false;
}

// === NEXT QUESTION ===
function nextQuestion() {
  if (!answers[currentIdx]) {
    // No answer selected — shouldn't happen (button disabled), but guard
    return;
  }
  if (currentIdx < questions.length - 1) {
    currentIdx++;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    showResults();
  }
}

// === SHOW RESULTS ===
function showResults() {
  const total   = questions.length;
  const score   = answers.filter(a => a?.isCorrect).length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;

  // Score display
  const pctEl = document.getElementById('r-pct');
  pctEl.textContent = `${percent}%`;
  pctEl.className   = 'result-pct ' +
    (percent >= 70 ? 'clr-good' : percent >= 50 ? 'clr-ok' : 'clr-bad');

  document.getElementById('r-frac').textContent =
    `${score} / ${total} дұрыс жауап`;

  const verdict = percent >= 90 ? 'Керемет! Өте жақсы нәтиже!'
    : percent >= 70 ? 'Жақсы! Сабақты жаттықтырып жүр!'
    : percent >= 50 ? 'Орташа нәтиже. Жаттыға бер!'
    : 'Тақырыпты қайталап, Сократпен сөйлес.';
  document.getElementById('r-verdict').textContent = verdict;

  // Breakdown table
  const tbody = document.getElementById('result-tbody');
  tbody.innerHTML = answers.map((a, i) => {
    if (!a) return '';
    return `<tr>
      <td class="mono" style="color:var(--ink-faint)">${i + 1}</td>
      <td>${escHtml(truncate(a.question, 55))}</td>
      <td class="mono">${a.studentAnswer || '—'}</td>
      <td class="mono">${a.correct}</td>
      <td>${a.isCorrect
        ? '<span class="icon-ok" aria-label="Дұрыс">✓</span>'
        : '<span class="icon-fail" aria-label="Қате">✗</span>'}</td>
    </tr>`;
  }).join('');

  // Update progress bar to 100%
  document.getElementById('prog-fill').style.width = '100%';

  showView('view-result');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Send result silently
  sendResult(score, total, percent);
}

// === SEND RESULT TO SERVER ===
async function sendResult(score, total, percent) {
  try {
    await fetch(`${API_URL}/test-result`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName,
        grade:     selectedGrade,
        topic:     selectedTopic,
        score,
        total,
        percent,
        answers,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (_) {
    // Silent — не прерывать UX ученика
  }
}

// === RETRY ===
function retry() {
  questions  = [];
  answers    = [];
  currentIdx = 0;
  showView('view-form');
}

// === UTILS ===
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function showErr(msg) {
  formErrEl.textContent = msg;
  formErrEl.style.display = 'block';
}

function hideErr() {
  formErrEl.style.display = 'none';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}
