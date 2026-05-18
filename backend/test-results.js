const fs   = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, 'test-results.json');
const MAX_RESULTS  = 1000;

function load() {
  try {
    if (fs.existsSync(RESULTS_FILE)) return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  } catch (_) {}
  return [];
}

function save(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8');
}

function addResult(result) {
  const results = load();
  results.push(result);
  if (results.length > MAX_RESULTS) results.splice(0, results.length - MAX_RESULTS);
  save(results);
}

function getTestStats() {
  const results = load();

  if (results.length === 0) {
    return {
      totalTests: 0, avgScore: 0, todayCount: 0, hardestTopic: '—',
      byGrade: {}, byTopic: {}, hardQuestions: [], recentResults: [],
    };
  }

  const byGrade   = {};
  const byTopic   = {};
  const qErrors   = {}; // question → { correct, wrong, topic }

  for (const r of results) {
    const g = String(r.grade);
    if (!byGrade[g]) byGrade[g] = { count: 0, totalPct: 0 };
    byGrade[g].count++;
    byGrade[g].totalPct += Number(r.percent) || 0;

    if (!byTopic[r.topic]) byTopic[r.topic] = { count: 0, totalPct: 0 };
    byTopic[r.topic].count++;
    byTopic[r.topic].totalPct += Number(r.percent) || 0;

    if (Array.isArray(r.answers)) {
      for (const a of r.answers) {
        const k = a.question;
        if (!qErrors[k]) qErrors[k] = { correct: 0, wrong: 0, topic: r.topic };
        a.isCorrect ? qErrors[k].correct++ : qErrors[k].wrong++;
      }
    }
  }

  const byGradeOut = {};
  for (const [g, d] of Object.entries(byGrade)) {
    byGradeOut[g] = { count: d.count, avgScore: Math.round(d.totalPct / d.count) };
  }

  const byTopicOut = {};
  for (const [t, d] of Object.entries(byTopic)) {
    byTopicOut[t] = { count: d.count, avgScore: Math.round(d.totalPct / d.count) };
  }

  const hardestTopic = Object.entries(byTopicOut)
    .sort((a, b) => a[1].avgScore - b[1].avgScore)[0]?.[0] ?? '—';

  const hardQuestions = Object.entries(qErrors)
    .map(([question, d]) => {
      const total        = d.correct + d.wrong;
      const errorPercent = Math.round((d.wrong / total) * 100);
      return { question, topic: d.topic, errorCount: d.wrong, total, errorPercent };
    })
    .filter(q => q.errorPercent >= 50)
    .sort((a, b) => b.errorPercent - a.errorPercent)
    .slice(0, 15);

  const today      = new Date().toISOString().slice(0, 10);
  const todayCount = results.filter(r => (r.timestamp || '').slice(0, 10) === today).length;
  const totalTests = results.length;
  const avgScore   = Math.round(results.reduce((s, r) => s + (Number(r.percent) || 0), 0) / totalTests);

  return {
    totalTests, avgScore, todayCount, hardestTopic,
    byGrade: byGradeOut, byTopic: byTopicOut,
    hardQuestions,
    recentResults: [...results].reverse().slice(0, 20),
  };
}

module.exports = { addResult, getTestStats };
