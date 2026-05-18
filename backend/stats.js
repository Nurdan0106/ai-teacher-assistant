const fs   = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, 'stats.json');
const MAX_SESSIONS = 1000;

const TOPIC_KEYWORDS = [
  { pattern: /цикл|while|for\b/i,                   label: 'Циклдер' },
  { pattern: /массив|тізім|array|list/i,             label: 'Массивтер' },
  { pattern: /функция|функц|def\b|function/i,        label: 'Функциялар' },
  { pattern: /екілік|санау|binary|hex|16-лық|8-лік/, label: 'Санау жүйелері' },
  { pattern: /алгоритм/i,                            label: 'Алгоритмдер' },
  { pattern: /шарт|if\b|else\b|switch/i,             label: 'Шартты операторлар' },
  { pattern: /деректер қоры|база|sql|access/i,       label: 'Деректер қоры' },
  { pattern: /желі|network|интернет|\bip\b|tcp/i,    label: 'Желілер' },
  { pattern: /сұрыптау|sort/i,                       label: 'Сұрыптау алгоритмдері' },
  { pattern: /рекурс/i,                              label: 'Рекурсия' },
];

function detectTopic(text) {
  if (!text) return 'Басқа';
  for (const { pattern, label } of TOPIC_KEYWORDS) {
    if (pattern.test(text)) return label;
  }
  return 'Басқа';
}

function load() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (_) {
    // corrupted file — start fresh
  }
  return {
    sessions: [],
    totalSessions: 0,
    totalMessages: 0,
    totalDurationSeconds: 0,
    byGrade: {},
    byTopic: {},
  };
}

function save(data) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function logSession({ grade, topic, detectedTopic, messageCount, durationSeconds }) {
  const data = load();
  const topicKey = detectedTopic || topic;

  data.sessions.push({
    grade,
    topic,
    detectedTopic: topicKey,
    messageCount,
    durationSeconds,
    timestamp: new Date().toISOString(),
  });

  if (data.sessions.length > MAX_SESSIONS) {
    data.sessions = data.sessions.slice(-MAX_SESSIONS);
  }

  data.totalSessions        += 1;
  data.totalMessages        += messageCount;
  data.totalDurationSeconds += durationSeconds;
  data.byGrade[grade]        = (data.byGrade[grade] || 0) + 1;
  data.byTopic[topicKey]     = (data.byTopic[topicKey] || 0) + 1;

  save(data);
}

function getStats() {
  const data = load();
  const avg  = data.totalSessions > 0
    ? Math.round(data.totalDurationSeconds / data.totalSessions)
    : 0;

  return {
    totalSessions:       data.totalSessions,
    totalMessages:       data.totalMessages,
    averageDurationSec:  avg,
    byGrade:             data.byGrade,
    topTopics: Object.entries(data.byTopic)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count })),
    recentSessions: [...data.sessions].reverse().slice(0, 10),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { logSession, getStats, detectTopic };
