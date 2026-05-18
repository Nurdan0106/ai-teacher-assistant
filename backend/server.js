require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');

const { CURRICULUM }             = require('./curriculum');
const { getSystemPrompt, getLessonPlanSystemPrompt, getLessonPlanUserPrompt } = require('./prompts');
const { logSession, getStats, detectTopic } = require('./stats');
const { addResult, getTestStats }           = require('./test-results');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT  = process.env.PORT || 3000;
const MODEL = 'claude-sonnet-4-6';

const client = new Anthropic({
  apiKey:     process.env.ANTHROPIC_API_KEY,
  timeout:    30_000, // 30 сек — не күт
  maxRetries: 1,      // SDK retry backoff 60+ сек болдырмайды
});

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');

// Барлық origin рұқсат — CORS (file://, Live Server, Railway, Netlify)
app.use(cors());

app.use(express.json());

// Request logging: method · path · status · ms
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () =>
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms`));
  next();
});

// Rate limit: 20 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Тым көп сұраныс. Бір минуттан кейін қайталаңыз.' },
});
app.use('/api/', limiter);

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

// ---------------------------------------------------------------------------
// GET /api/curriculum/:grade
// ---------------------------------------------------------------------------
app.get('/api/curriculum/:grade', (req, res) => {
  const grade = parseInt(req.params.grade, 10);
  const topics = CURRICULUM[grade];
  if (!topics) {
    return res.status(404).json({ error: `${grade}-сынып бағдарламасы табылмады` });
  }
  res.json({ grade, topics });
});

// ---------------------------------------------------------------------------
// POST /api/chat  — SSE streaming
// ---------------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  const { grade, topic, messages } = req.body;

  if (!grade || !topic || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'grade, topic және messages міндетті' });
  }

  // Set SSE headers before streaming starts
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const startTime = Date.now();

  try {
    // System prompt cached with cache_control so repeated calls in the same
    // grade/topic reuse the cached prefix — saves tokens & latency.
    const stream = client.messages.stream({
      model:      MODEL,
      max_tokens: 1024,
      system: [
        {
          type:          'text',
          text:          getSystemPrompt(grade, topic),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    stream.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

    await stream.finalMessage();

    // [DONE] жіберу — браузер алдымен жауапты алуы керек
    res.write('data: [DONE]\n\n');
    res.end();

    // Статистиканы жауап жіберілгеннен КЕЙІН жаз.
    // stats.json өзгерісі Live Server hot-reload-ты стриминг кезінде емес,
    // аяқталғаннан кейін іске қосады.
    const firstUser    = messages.find(m => m.role === 'user');
    const detectedTopic = detectTopic(firstUser?.content || '');
    logSession({
      grade,
      topic,
      detectedTopic,
      messageCount:    messages.length,
      durationSeconds: Math.round((Date.now() - startTime) / 1000),
    });
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// ---------------------------------------------------------------------------
// POST /api/lesson-plan  — non-streaming
// ---------------------------------------------------------------------------
app.post('/api/lesson-plan', async (req, res) => {
  const { grade, topic, teacherName } = req.body;

  if (!grade || !topic) {
    return res.status(400).json({ error: 'grade және topic міндетті' });
  }

  const teacher = teacherName || 'Мұғалім';
  const today   = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  try {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 4096,
      system: [
        {
          type:          'text',
          text:          getLessonPlanSystemPrompt(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: getLessonPlanUserPrompt(grade, topic, teacher, today) }],
    }, { timeout: 120_000 });

    const lessonPlan = response.content.find((b) => b.type === 'text')?.text ?? '';

    res.json({
      grade,
      topic,
      teacherName: teacher,
      lessonPlan,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[lesson-plan] ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/test  — non-streaming, returns JSON array
// ---------------------------------------------------------------------------
app.post('/api/test', async (req, res) => {
  const { grade, topic, count = 5 } = req.body;

  if (!grade || !topic) {
    return res.status(400).json({ error: 'grade және topic міндетті' });
  }

  const safeCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);

  const userPrompt =
    `${grade}-сынып оқушылары үшін "${topic}" тақырыбы бойынша ` +
    `${safeCount} сұрақтан тұратын ҰБТ стилінде тест жаса.\n\n` +
    `ТІКЕЛЕЙ JSON МАССИВІН ҚАЙТАР (ешқандай қосымша мәтінсіз):\n` +
    `[\n` +
    `  {\n` +
    `    "question": "Сұрақ мәтіні",\n` +
    `    "options": {\n` +
    `      "A": "Бірінші нұсқа",\n` +
    `      "B": "Екінші нұсқа",\n` +
    `      "C": "Үшінші нұсқа",\n` +
    `      "D": "Төртінші нұсқа"\n` +
    `    },\n` +
    `    "correct": "A",\n` +
    `    "explanation": "Дұрыс жауаптың түсіндірмесі"\n` +
    `  }\n` +
    `]\n\n` +
    `Сұрақтар ҰБТ стилінде болсын. Тек ҚАЗАҚ тілінде. Тек JSON.`;

  try {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 2048,
      system: [
        {
          type:          'text',
          text:          'Сен — Қазақстан ҰБТ информатика тест жасаушысысың. Жауабыңды тек таза JSON форматында қайтарасың — ешқандай markdown, ешқандай түсіндірме мәтін жоқ. Тек JSON массиві. Тек ҚАЗАҚ тілінде.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    }, { timeout: 90_000 });

    const rawText   = response.content.find((b) => b.type === 'text')?.text ?? '[]';
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);

    let questions = [];
    if (jsonMatch) {
      try {
        questions = JSON.parse(jsonMatch[0]);
      } catch (_) {
        questions = [];
      }
    }

    res.json({ grade, topic, count: questions.length, questions });
  } catch (err) {
    console.error('[test] ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats
// ---------------------------------------------------------------------------
app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

// ---------------------------------------------------------------------------
// POST /api/test-result  — оқушының тест нәтижесін сақтау
// ---------------------------------------------------------------------------
app.post('/api/test-result', (req, res) => {
  const { studentName, grade, topic, score, total, percent, answers, timestamp } = req.body;

  if (!studentName || !grade || !topic || score === undefined || !total) {
    return res.status(400).json({ error: 'Міндетті өрістер жоқ' });
  }

  addResult({
    studentName,
    grade:     String(grade),
    topic,
    score:     Number(score),
    total:     Number(total),
    percent:   Number(percent) || 0,
    answers:   Array.isArray(answers) ? answers : [],
    timestamp: timestamp || new Date().toISOString(),
  });

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/test-stats  — жиынтық тест статистикасы
// ---------------------------------------------------------------------------
app.get('/api/test-stats', (_req, res) => {
  res.json(getTestStats());
});

// ---------------------------------------------------------------------------
// GET /api/glossary/:grade  — IT-терминдер глоссарийі
// ---------------------------------------------------------------------------
app.get('/api/glossary/:grade', async (req, res) => {
  const grade = parseInt(req.params.grade, 10);
  if (grade < 5 || grade > 11 || isNaN(grade)) {
    return res.status(400).json({ error: 'Сынып 5-11 аралығында болуы керек' });
  }

  const userPrompt =
    `${grade}-сынып информатика пәнінің деңгейіне сәйкес ` +
    `20 маңызды IT-терминнің қазақша глоссарийін жаса.\n\n` +
    `ТІКЕЛЕЙ JSON МАССИВІН ҚАЙТАР (ешқандай қосымша мәтінсіз):\n` +
    `[\n` +
    `  {\n` +
    `    "term": "Термин атауы",\n` +
    `    "definition": "Қысқа анықтама (1-2 сөйлем)",\n` +
    `    "example": "Нақты мысал"\n` +
    `  }\n` +
    `]\n\n` +
    `Терминдер ${grade}-сынып деңгейіне сай болсын. Тек ҚАЗАҚ тілінде. Тек JSON.`;

  try {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 2048,
      system: [
        {
          type:          'text',
          text:          'Сен — Қазақстан мектептерінің информатика пәні бойынша терминология маманысың. Жауабыңды тек таза JSON форматында қайтарасың. Тек ҚАЗАҚ тілінде.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    }, { timeout: 90_000 });

    const rawText  = response.content.find((b) => b.type === 'text')?.text ?? '[]';
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);

    let terms = [];
    if (jsonMatch) {
      try { terms = JSON.parse(jsonMatch[0]); } catch (_) { terms = []; }
    }

    res.json({ grade, count: terms.length, terms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Сократ сервері ${PORT} портта іске қосылды`);
  console.log(`  Health:     http://localhost:${PORT}/health`);
  console.log(`  Curriculum: http://localhost:${PORT}/api/curriculum/8`);
  console.log(`  Glossary:   http://localhost:${PORT}/api/glossary/8`);
  console.log(`  Stats:      http://localhost:${PORT}/api/stats`);
});
