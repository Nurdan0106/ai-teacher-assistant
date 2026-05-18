/* ============================================================
   teacher.js — Сократ · Мұғалім кабинетінің логикасы
   ============================================================ */

const API_URL = 'http://localhost:3000/api';

// Сабақ жоспарының соңғы мәтіні (жүктеу үшін)
let lastLessonPlan   = '';
let lastTestData     = [];
let statsInterval    = null;
let testStatsInterval = null;

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupLessonForm();
  setupTestForm();
  // Статистиканы бірінші рет жүктеу (вкладка ашылғанда)
});

// ============================================================
// ВКЛАДКАЛАРДЫ АУЫСТЫРУ
// ============================================================
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
    b.setAttribute('aria-selected', String(b.dataset.tab === name));
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${name}`);
  });

  if (name === 'stats') {
    loadStats();
    loadTestStats();
    if (!statsInterval)     statsInterval     = setInterval(loadStats,     60_000);
    if (!testStatsInterval) testStatsInterval = setInterval(loadTestStats, 30_000);
  } else {
    clearInterval(statsInterval);
    clearInterval(testStatsInterval);
    statsInterval     = null;
    testStatsInterval = null;
  }
}

// ============================================================
// СЫНЫП БОЙЫНША ТАҚЫРЫПТАРДЫ ЖҮКТЕУ
// ============================================================
async function loadTopics(grade, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  try {
    const res      = await fetch(`${API_URL}/curriculum/${grade}`);
    const { topics } = await res.json();
    sel.innerHTML = topics
      .map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`)
      .join('');
  } catch (_) {
    sel.innerHTML = '<option>Қате — сервер қосулы ма?</option>';
  }
}

// ============================================================
// САБАҚ ЖОСПАРЫ ФОРМАСЫ
// ============================================================
function setupLessonForm() {
  const gradeEl   = document.getElementById('lp-grade');
  const submitEl  = document.getElementById('lp-submit');
  const downloadEl = document.getElementById('lp-download');

  // Бастапқы тақырыптарды жүктеу
  loadTopics(gradeEl.value, 'lp-topic');

  gradeEl.addEventListener('change', () => loadTopics(gradeEl.value, 'lp-topic'));

  submitEl.addEventListener('click', generateLessonPlan);

  downloadEl.addEventListener('click', () => {
    if (!lastLessonPlan) return;
    const grade = document.getElementById('lp-grade').value;
    const topic = document.getElementById('lp-topic').value;
    const date  = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
    const header =
      'ҚР БҒМ талаптарына сәйкес жасалған ҚМЖ\n' +
      'Барлығы/Көбі/Кейбірі форматында\n' +
      '═══════════════════════════════════════════\n\n';
    downloadFile(`ҚМЖ_${grade}сынып_${slugify(topic)}_${date}.txt`, header + lastLessonPlan);
  });
}

async function generateLessonPlan() {
  const grade       = document.getElementById('lp-grade').value;
  const topic       = document.getElementById('lp-topic').value;
  const teacherName = document.getElementById('lp-teacher').value.trim() || 'Мұғалім';
  const submitBtn   = document.getElementById('lp-submit');
  const spinner     = document.getElementById('lp-spinner');
  const resultArea  = document.getElementById('lp-result');

  submitBtn.disabled = true;
  spinner.innerHTML  = '<span class="spinner"></span>ҚМЖ жасалуда… (60-90 сек)';
  spinner.classList.remove('hidden');
  resultArea.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/lesson-plan`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grade, topic, teacherName }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    const { lessonPlan } = await res.json();
    lastLessonPlan = lessonPlan;

    document.getElementById('lp-content').innerHTML = formatLessonPlan(lessonPlan);
    resultArea.classList.remove('hidden');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    console.error('[lesson-plan]', err.message);
    showError('lp-content', `⚠ ${err.message}`);
    resultArea.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('hidden');
  }
}

// ── Сабақ жоспарын HTML-ге айналдыру ──
function formatLessonPlan(text) {
  // ҚМЖ форматын анықтау (═══ немесе ҚЫСҚАМЕРЗІМДІ бар ма?)
  if (/═{4,}/.test(text) || text.includes('ҚЫСҚАМЕРЗІМДІ')) {
    return formatKMZh(text);
  }

  // Ескі ## форматы
  const sections = text.split(/(?=^## )/m).filter(s => s.trim());
  let html = '';

  for (const section of sections) {
    const lines   = section.split('\n');
    const heading = lines[0].replace(/^## /, '').trim();
    const body    = lines.slice(1).join('\n').trim();

    const bodyHtml = body
      .replace(/^- (.+)$/gm,        '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/^\d+[\.\)]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g,    '<strong>$1</strong>')
      .replace(/\n\n/g,              '</p><p>')
      .replace(/\n/g,                '<br>');

    html += `
      <div class="lp-section">
        <h3 class="lp-heading">${escHtml(heading)}</h3>
        <div class="lp-body"><p>${bodyHtml}</p></div>
      </div>`;
  }

  return html || `<p style="color:var(--ink-muted)">${escHtml(text)}</p>`;
}

// ── ҚМЖ форматын HTML-ге айналдыру ──
function formatKMZh(text) {
  const lines = text.split('\n');
  let html    = '<div class="kmzh-body">';

  for (const line of lines) {
    const t = line.trimEnd();
    const c = t.trim();

    if (!c) {
      html += '<div style="height:0.35em"></div>';
      continue;
    }

    // ═══ шекара
    if (/^═{4,}/.test(c)) {
      html += '<div class="kmzh-border"></div>';
      continue;
    }

    // ─── бөлгіш
    if (/^─{4,}/.test(c)) {
      html += '<hr class="kmzh-rule">';
      continue;
    }

    // Тақырып жолы
    if (c.startsWith('ҚЫСҚАМЕРЗІМДІ')) {
      html += `<div class="kmzh-title">${escHtml(c)}</div>`;
      continue;
    }

    // А), Б), В) ішкі бөлімдер
    if (/^[АБВ]\)\s/.test(c)) {
      html += `<div class="kmzh-sub-head">${escHtml(c)}</div>`;
      continue;
    }

    // Бас әріппен жазылған бөлім тақырыптары
    if (isUpperKk(c)) {
      html += `<div class="kmzh-section-head">${escHtml(c)}</div>`;
      continue;
    }

    // Қос нүктемен аяқталатын белгілер
    if (c.endsWith(':') && c.length < 65 && !c.startsWith('-') && !c.startsWith('•')) {
      html += `<div class="kmzh-label"><strong>${escHtml(c)}</strong></div>`;
      continue;
    }

    // Тізім нүктелері
    if (c.startsWith('- ') || c.startsWith('• ')) {
      html += `<div class="kmzh-bullet">&bull;&nbsp;${escHtml(c.replace(/^[-•]\s+/, ''))}</div>`;
      continue;
    }

    // «» тіркестер
    if (c.startsWith('«')) {
      html += `<div class="kmzh-quote">${escHtml(c)}</div>`;
      continue;
    }

    // Мета-жолдар (Мектеп:, Мұғалім:...)
    if (/^(Мектеп|Мұғалім|Күні|Сынып|Пән|Тақырып|Қатыс)/.test(c)) {
      html += `<div class="kmzh-meta">${escHtml(c)}</div>`;
      continue;
    }

    // Қалған жолдар
    html += `<div class="kmzh-line">${escHtml(c)}</div>`;
  }

  html += '</div>';
  return html;
}

// ── Бас әріп қазақша жолды анықтау ──
function isUpperKk(str) {
  const s = str.trim();
  if (s.length < 4) return false;
  // Барлық әріптер бас әріп пе?
  return s === s.toUpperCase() && /[А-ЯҚҒҢҮҰӨІӘЁ]/.test(s);
}

// ============================================================
// ТЕСТ ФОРМАСЫ
// ============================================================
function setupTestForm() {
  const gradeEl    = document.getElementById('test-grade');
  const submitEl   = document.getElementById('test-submit');
  const downloadEl = document.getElementById('test-download');

  loadTopics(gradeEl.value, 'test-topic');

  gradeEl.addEventListener('change', () => loadTopics(gradeEl.value, 'test-topic'));

  submitEl.addEventListener('click', generateTest);

  downloadEl.addEventListener('click', () => {
    if (!lastTestData.length) return;
    const topic = document.getElementById('test-topic').value;
    downloadFile(`ubt-test-${slugify(topic)}.txt`, formatTestForDownload(lastTestData));
  });
}

async function generateTest() {
  const grade    = document.getElementById('test-grade').value;
  const topic    = document.getElementById('test-topic').value;
  const count    = parseInt(document.getElementById('test-count').value);
  const submitBtn = document.getElementById('test-submit');
  const spinner   = document.getElementById('test-spinner');
  const resultArea = document.getElementById('test-result');

  submitBtn.disabled = true;
  spinner.classList.remove('hidden');
  resultArea.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/test`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grade, topic, count }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    const { questions } = await res.json();

    if (!questions || questions.length === 0) {
      throw new Error('Сұрақтар жасалмады');
    }

    lastTestData = questions;
    document.getElementById('test-content').innerHTML = renderQuestions(questions);
    resultArea.classList.remove('hidden');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Жауапты көрсету батырмаларына оқиға тыңдаушы қос
    document.querySelectorAll('.reveal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card   = btn.closest('.question-card');
        const reveal = card.querySelector('.answer-reveal');
        const hidden = reveal.hasAttribute('hidden');

        reveal.toggleAttribute('hidden', !hidden);
        btn.textContent = hidden ? 'Жасыру' : 'Жауапты көрсету';

        if (hidden) {
          const correct = btn.dataset.correct;
          card.querySelectorAll('.option').forEach(opt => {
            if (opt.dataset.letter === correct) opt.classList.add('correct');
          });
        } else {
          card.querySelectorAll('.option').forEach(o => o.classList.remove('correct'));
        }
      });
    });

  } catch (err) {
    console.error('[test]', err.message);
    showError('test-content', `⚠ ${err.message}`);
    resultArea.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('hidden');
  }
}

// ── Тест сұрақтарын HTML-ге шығару ──
function renderQuestions(questions) {
  return questions.map((q, i) => {
    // options may be {A: "...", B: "..."} or ["A) ...", ...]
    let opts = '';
    if (q.options && !Array.isArray(q.options)) {
      opts = ['A', 'B', 'C', 'D']
        .filter(l => q.options[l] !== undefined)
        .map(l => `<div class="option" data-letter="${l}">${l}) ${escHtml(q.options[l])}</div>`)
        .join('');
    } else {
      opts = (q.options || []).map((opt, oi) => {
        const letter = ['A', 'B', 'C', 'D'][oi] || String(oi);
        return `<div class="option" data-letter="${letter}">${escHtml(opt)}</div>`;
      }).join('');
    }

    return `
      <div class="question-card">
        <div class="question-header">
          <span class="question-num">${i + 1}</span>
          <span class="question-text">${escHtml(q.question || '')}</span>
        </div>
        <div class="question-options">${opts}</div>
        <button class="reveal-btn" data-correct="${escHtml(q.correct || 'A')}">
          Жауапты көрсету
        </button>
        <div class="answer-reveal" hidden>
          <span class="correct-badge">✓ Дұрыс жауап: ${escHtml(q.correct || '—')}</span>
          <p class="explanation-text">${escHtml(q.explanation || '')}</p>
        </div>
      </div>`;
  }).join('');
}

// ── Тестті жүктеу үшін мәтін ──
function formatTestForDownload(questions) {
  return questions.map((q, i) => {
    let opts;
    if (q.options && !Array.isArray(q.options)) {
      opts = ['A', 'B', 'C', 'D']
        .filter(l => q.options[l] !== undefined)
        .map(l => `${l}) ${q.options[l]}`)
        .join('\n');
    } else {
      opts = (q.options || []).join('\n');
    }
    return `${i + 1}. ${q.question}\n${opts}\n\nДұрыс жауап: ${q.correct}\nТүсіндірме: ${q.explanation}`;
  }).join('\n\n' + '─'.repeat(40) + '\n\n');
}

// ============================================================
// СТАТИСТИКА
// ============================================================
async function loadStats() {
  try {
    const res  = await fetch(`${API_URL}/stats`);
    const data = await res.json();

    // Жинақ карточкалары
    setText('stat-total',     data.totalSessions ?? 0);
    setText('stat-avg-msg',   data.totalSessions
      ? Math.round(data.totalMessages / data.totalSessions)
      : 0);

    const topTopic = data.topTopics?.[0]?.topic;
    setText('stat-top-topic', topTopic
      ? topTopic.slice(0, 20) + (topTopic.length > 20 ? '…' : '')
      : '—');

    const topGradeEntry = Object.entries(data.byGrade || {})
      .sort((a, b) => b[1] - a[1])[0];
    setText('stat-top-grade', topGradeEntry ? `${topGradeEntry[0]}-сынып` : '—');

    // Сынып кестесі
    const total = data.totalSessions || 1;
    const gradeRows = Object.entries(data.byGrade || {})
      .sort((a, b) => b[1] - a[1])
      .map(([grade, count]) => `
        <tr>
          <td>${grade}-сынып</td>
          <td>${count}</td>
          <td>${Math.round(count / total * 100)}%</td>
        </tr>`).join('') || emptyRow(3);

    document.getElementById('grade-table-body').innerHTML = gradeRows;

    // Тақырып кестесі
    const topicRows = (data.topTopics || [])
      .map(({ topic, count }) => `
        <tr>
          <td>${escHtml(topic)}</td>
          <td>${count}</td>
          <td>${Math.round(count / total * 100)}%</td>
        </tr>`).join('') || emptyRow(3);

    document.getElementById('topic-table-body').innerHTML = topicRows;

    // Жаңарту уақыты
    const updatedEl = document.getElementById('stats-updated');
    if (updatedEl) {
      updatedEl.textContent =
        `Жаңартылды: ${new Date().toLocaleTimeString('kk-KZ')} · Автоматты жаңарту: 60 сек`;
    }

  } catch (_) {
    document.getElementById('grade-table-body').innerHTML = emptyRow(3, 'Деректер жоқ');
    document.getElementById('topic-table-body').innerHTML = emptyRow(3, 'Деректер жоқ');
  }
}

// ============================================================
// ТЕСТ СТАТИСТИКАСЫ
// ============================================================
async function loadTestStats() {
  try {
    const res  = await fetch(`${API_URL}/test-stats`);
    const data = await res.json();

    setText('ts-total', data.totalTests ?? 0);
    setText('ts-avg',   data.avgScore   != null ? `${data.avgScore}%` : '—');
    setText('ts-today', data.todayCount ?? 0);

    const hardTopic = data.hardestTopic || '—';
    const hardEl    = document.getElementById('ts-hard');
    if (hardEl) hardEl.textContent = hardTopic.slice(0, 18) + (hardTopic.length > 18 ? '…' : '');

    // Қиын сұрақтар кестесі
    const hRows = (data.hardQuestions || []).map(q => {
      const cls = q.errorPercent > 70 ? 'err-high' : 'err-mid';
      const pctCls = q.errorPercent > 70 ? 'err-pct-high' : 'err-pct-mid';
      return `<tr class="${cls}">
        <td>${escHtml(truncate(q.question, 60))}</td>
        <td>${escHtml(q.topic)}</td>
        <td class="${pctCls}">${q.errorPercent}%</td>
        <td>${q.total}</td>
      </tr>`;
    }).join('') || emptyRow(4, 'Деректер жоқ (50%+ қателер болса шығады)');

    document.getElementById('hard-q-body').innerHTML = hRows;

    // Соңғы нәтижелер
    const rRows = (data.recentResults || []).slice(0, 20).map(r => {
      const dt   = r.timestamp ? new Date(r.timestamp) : null;
      const time = dt ? dt.toLocaleString('ru-RU', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit',  minute: '2-digit',
      }) : '—';
      const pct  = r.percent ?? Math.round((r.score / r.total) * 100);
      const pctStyle = pct >= 70 ? 'color:var(--sage);font-weight:600'
        : pct >= 50 ? '' : 'color:var(--terracotta);font-weight:600';
      return `<tr>
        <td>${escHtml(r.studentName || '—')}</td>
        <td>${escHtml(String(r.grade))}-сынып</td>
        <td>${escHtml(truncate(r.topic || '—', 28))}</td>
        <td style="${pctStyle}">${r.score}/${r.total} (${pct}%)</td>
        <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--ink-faint)">${time}</td>
      </tr>`;
    }).join('') || emptyRow(5, 'Тест нәтижелері жоқ');

    document.getElementById('recent-results-body').innerHTML = rRows;

    const updEl = document.getElementById('test-stats-updated');
    if (updEl) {
      updEl.textContent = `Жаңартылды: ${new Date().toLocaleTimeString('kk-KZ')}`;
    }

  } catch (_) {
    document.getElementById('hard-q-body').innerHTML    = emptyRow(4, 'Деректер жоқ');
    document.getElementById('recent-results-body').innerHTML = emptyRow(5, 'Деректер жоқ');
  }
}

// ── Тест статистикасын қолмен жаңарту ──
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('refresh-test-stats');
  if (btn) btn.addEventListener('click', loadTestStats);
});

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : (str || '');
}

// ============================================================
// ФАЙЛДЫ ЖҮКТЕУ
// ============================================================
function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// УТИЛИТТЕР
// ============================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 40);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function emptyRow(cols, msg = 'Жүктелуде…') {
  return `<tr><td colspan="${cols}" style="color:var(--ink-faint);font-size:0.875rem">${msg}</td></tr>`;
}

function showError(containerId, msg) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<p style="color:var(--terracotta);font-size:0.9rem">⚠ ${escHtml(msg)}</p>`;
  }
}
