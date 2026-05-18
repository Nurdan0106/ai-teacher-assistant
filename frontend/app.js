/* ============================================================
   app.js — Сократ AI тьютор · Чат логикасы
   ============================================================ */

const API_URL = 'http://localhost:3000/api';

// === КҮЙІ (STATE) ===
let history      = [];
let isLoading    = false;
let currentGrade = parseInt(localStorage.getItem('socrates-grade') || '8');
let currentTopic = '';

// ============================================================
// НҰСҚАУЛЫҚ СҰРАҚТАРЫ (grade+topic бойынша)
// ============================================================
const HINTS = {
  // ── 5-сынып ──────────────────────────────────────────────
  'Информация және ақпараттық процестер': [
    'Ақпарат деген не? Мысал келтір',
    'Деректер мен ақпараттың айырмашылығы?',
    'Ақпарат қалай берілуі мүмкін?',
    'Компьютер ақпаратты қалай өңдейді?',
  ],
  'Компьютер құрылысы': [
    'Процессор не үшін қажет?',
    'Оперативті жад (RAM) дегеніміз не?',
    'Енгізу және шығару құрылғыларының мысалдары?',
    'Қатты диск пен флеш-карта айырмашылығы?',
  ],
  'Мәтіндік редактор': [
    'Мәтінді ортаға туралау үшін не басамыз?',
    'Шрифт өлшемін қалай өзгертеді?',
    'Емле қателерін бағдарлама қалай табады?',
    'Word файлын сақтаудың 2 жолы?',
  ],
  'Графикалық редактор': [
    'Paint бағдарламасында сурет қалай салынады?',
    'Суреттің бір бөлігін қалай өшіруге болады?',
    'Растрлық пен векторлық сурет айырмашылығы?',
    'Суретті жасыл түспен қалай бояймыз?',
  ],
  'Интернет негіздері': [
    'Интернет дегеніміз не?',
    'Браузер не үшін қажет?',
    'URL мекенжайы деген не?',
    'Электрондық пошта қалай жұмыс істейді?',
  ],

  // ── 6-сынып ──────────────────────────────────────────────
  'Алгоритм түсінігі': [
    'Алгоритм деген не? Күнделікті мысал?',
    'Алгоритмнің 4 қасиетін атай аласыңба?',
    'Шай жасаудың алгоритмін жаз',
    'Алгоритм неше түрге бөлінеді?',
  ],
  'Сызықтық алгоритм': [
    'Сызықтық алгоритмде командалар қалай орындалады?',
    'Таңертеңгі іс-қимылдарыңды алгоритм ретінде жаз',
    'Блок-схемада қандай фигурлар болады?',
    'Сызықтық алгоритмнің шектеуі не?',
  ],
  'Тармақталу алгоритмі': [
    'Тармақталуда шарт не үшін керек?',
    'Ауа +20°C болса не кием — алгоритм?',
    'Толық және толық емес тармақталу айырмашылығы?',
    'Блок-схемада ромб нені білдіреді?',
  ],
  'Циклдік алгоритм': [
    'Цикл не үшін қолданылады?',
    '5 рет "Сәлем!" шығаратын циклды сипатта',
    'while және for циклдерінің айырмашылығы?',
    'Шексіз цикл деген не? Мысал?',
  ],
  'Кестелік процессор Excel': [
    'Excel-де ұяшық адресі қалай жазылады?',
    'SUM формуласы не есептейді?',
    'Баған мен жолдың айырмашылығы?',
    'Диаграмма не үшін қолданылады?',
  ],

  // ── 7-сынып ──────────────────────────────────────────────
  'Санау жүйелері (екілік, сегіздік, он алтылық)': [
    '42 санын екілікке қалай аударамыз?',
    'Неге компьютерлер екілік жүйені пайдаланады?',
    '1010₂ санының онлық мәні нешеге тең?',
    '16-лық жүйеде A, B, C нені білдіреді?',
  ],
  'Логикалық алгебра негіздері': [
    'AND операциясының ақиқат кестесін жаз',
    'OR операциясы қашан ақиқат болады?',
    'NOT операциясы не жасайды?',
    '1 AND 0 OR 1 нің нәтижесі?',
  ],
  'Блок-схемалар': [
    'Блок-схемада параллелепипед нені білдіреді?',
    'Ромб фигурасы не үшін қолданылады?',
    'if операторын блок-схемада қалай кескіндейміз?',
    'for циклін блок-схемада қалай суреттейміз?',
  ],
  'Scratch бағдарламалау': [
    'Scratch-та кейіпкер қалай жылжытылады?',
    'Scratch-та цикл жасауға қандай блок керек?',
    'Айнымалы деген не? Scratch-та мысал?',
    'Scratch-та шарт блогы қалай қолданылады?',
  ],

  // ── 8-сынып ──────────────────────────────────────────────
  'Python бағдарламалау тілі негіздері': [
    'Python-да print() функциясы не жасайды?',
    'input() арқылы деректі қалай аламыз?',
    '2 + 3 * 4 нің нәтижесі Python-да қанша?',
    '# символы не үшін қолданылады?',
  ],
  'Айнымалылар мен деректер түрлері': [
    'int, float, str, bool айырмашылықтары?',
    'type() функциясы не қайтарады?',
    'x = "5" бен x = 5 айырмашылығы не?',
    'Айнымалы атауына қандай шектеулер бар?',
  ],
  'Шартты операторлар': [
    'if-else операторы қалай жазылады?',
    'elif не үшін қолданылады?',
    '== мен = айырмашылығы не?',
    'Санды жұп па деп тексеру шарты?',
  ],
  'Циклдер': [
    'while циклін түсінбеймін',
    'for цикліндегі range(5) нені білдіреді?',
    'break операторы не жасайды?',
    '1-ден 10-ға дейін сандарды шығар',
  ],
  'Функциялар': [
    'Python-да функция қалай жасалады?',
    'return операторы не үшін керек?',
    'Аргумент пен параметр айырмашылығы?',
    'Функция неге қажет? Мысал?',
  ],
  'Тізімдер мен массивтер': [
    'Python тізімін қалай жасаймыз?',
    'Тізімнен бірінші элементті қалай аламыз?',
    'append() мен insert() айырмашылығы?',
    'Массивтен максимумды тап',
  ],

  // ── 9-сынып ──────────────────────────────────────────────
  'Деректер қоры негіздері (Access/SQL)': [
    'SQL-де SELECT операторы не жасайды?',
    'WHERE шарты не үшін қолданылады?',
    'Кесте мен өріс дегеніміз не?',
    'Бастапқы кілт (PRIMARY KEY) деген не?',
  ],
  'Компьютерлік желілер': [
    'LAN, WAN, MAN айырмашылықтары?',
    'IP-мекенжай дегеніміз не?',
    'Маршрутизатор мен коммутатор айырмасы?',
    'Желіде пакет деген не?',
  ],
  'Интернет протоколдары': [
    'TCP/IP протоколы не үшін қажет?',
    'HTTP пен HTTPS айырмашылығы?',
    'DNS не үшін қолданылады?',
    'Порт нөмері дегеніміз не?',
  ],
  'Ақпараттық қауіпсіздік': [
    'Вирус пен трояндық бағдарлама айырмасы?',
    'Фишинг деген не?',
    'Күшті пароль жасаудың 3 ережесі?',
    'Шифрлеу дегеніміз не?',
  ],
  'ҰБТ-ға дайындық': [
    'Санау жүйелерін өзара аударуды қайталайықшы',
    'SQL WHERE шарты қандай синтаксиспен жазылады?',
    'Логикалық операциялар кестесін еске түсір',
    'IP-мекенжайдың форматы қандай?',
  ],

  // ── 10-сынып ─────────────────────────────────────────────
  'Объектіге бағытталған бағдарламалау': [
    'Класс пен объект айырмашылығы?',
    'Инкапсуляция дегеніміз не?',
    'Мұрагерлік (inheritance) не береді?',
    '__init__ методы не үшін қолданылады?',
  ],
  'Алгоритмдер күрделілігі': [
    'O(n) күрделілігі дегеніміз не?',
    'O(n²) пен O(n log n) айырмашылығы?',
    'Ең нашар жағдай (worst case) деген не?',
    'Бинарлы іздеудің күрделілігі?',
  ],
  'Сұрыптау алгоритмдері': [
    'Көпіршік сұрыптау қалай жұмыс істейді?',
    'Тез сұрыптау (quick sort) неге тезірек?',
    'Сұрыптаудың тұрақтылығы (stability) деген не?',
    '[5, 2, 8, 1] массивін bubble sort-пен сұрыпта',
  ],
  'Іздеу алгоритмдері': [
    'Сызықтық іздеу дегеніміз не?',
    'Бинарлы іздеу неліктен тезірек?',
    'Бинарлы іздеу үшін массив қандай болуы керек?',
    '[1, 3, 5, 7, 9] ішінен 7-ні бинарлы іздеу',
  ],
  'Веб-бағдарламалау негіздері': [
    'HTML, CSS, JavaScript рөлдері?',
    '<div> мен <span> айырмашылығы?',
    'CSS-те класс селектор қалай жазылады?',
    'DOM дегеніміз не?',
  ],

  // ── 11-сынып ─────────────────────────────────────────────
  'Жасанды интеллект негіздері': [
    'Машиналық оқыту дегеніміз не?',
    'Нейрондық желі қалай жұмыс істейді?',
    'Оқытылған және оқытылмаған оқыту айырмасы?',
    'ЖИ-дің күнделікті өмірдегі мысалдары?',
  ],
  'Деректерді талдау': [
    'Деректер жиынын (dataset) қалай тазалаймыз?',
    'Гистограмма мен диаграмма айырмашылығы?',
    'Орташа мән мен медиана қашан ерекшеленеді?',
    'Python-да деректер талдауға арналған кітапханалар?',
  ],
  'Желілік қауіпсіздік': [
    'DDoS-шабуыл дегеніміз не?',
    'VPN не береді?',
    'Брандмауэр (firewall) не жасайды?',
    'SQL-инъекция дегеніміз не?',
  ],
  'ҰБТ тест дайындығы': [
    '10011₂ санын онлыққа аудар',
    'Python: range(1, 10, 2) не береді?',
    'SELECT-FROM-WHERE синтаксисі?',
    'О(n log n) қай алгоритмге тән?',
  ],
  'Жобалық жұмыс': [
    'Жобаны жоспарлаудың кезеңдері қандай?',
    'ТЗ (техникалық тапсырма) дегеніміз не?',
    'Git не үшін қолданылады?',
    'MVP концепциясы дегеніміз не?',
  ],

  // ── Жалпы резервтік ──────────────────────────────────────
  _default: [
    'Осы тақырыпты түсіндіріп бер',
    'Ең маңызды түсінікті атап шық',
    'Мысал мен есеп келтір',
    'Осы тақырыпта не қиын?',
  ],
};

// === DOM сілтемелері ===
const gradeSelect   = document.getElementById('grade-select');
const topicSelect   = document.getElementById('topic-select');
const messagesEl    = document.getElementById('messages');
const questionInput = document.getElementById('question-input');
const sendBtn       = document.getElementById('send-btn');
const newChatBtn    = document.getElementById('new-chat-btn');

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
// Перезагрузку страницы ловим здесь — если это внешний триггер (Live Server),
// будет видно в консоли ДО reload.
window.addEventListener('beforeunload', () => {
  console.log('[DEBUG] ⚠ Страница перезагружается! Время:', new Date().toISOString());
});

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[DEBUG] DOM ready. sendBtn:', sendBtn, '| questionInput:', questionInput);

  if (gradeSelect) gradeSelect.value = String(currentGrade);
  await loadTopics(currentGrade);
  setupEventListeners();
});

// ============================================================
// НҰСҚАУЛЫҚ БАТЫРМАЛАРЫН ЖАҢАРТУ
// ============================================================
function updateHints(grade, topic) {
  const btns = document.querySelectorAll('.hint-btn');
  if (!btns.length) return;
  const hints = HINTS[topic] || HINTS._default;
  btns.forEach((btn, i) => {
    const text = hints[i] ?? hints[hints.length - 1];
    btn.dataset.hint = text;
    btn.textContent  = text;
  });
}

// ============================================================
// ТАҚЫРЫПТАРДЫ ЖҮКТЕУ
// ============================================================
async function loadTopics(grade) {
  if (!topicSelect) return;
  try {
    const res      = await fetch(`${API_URL}/curriculum/${grade}`);
    const { topics } = await res.json();

    topicSelect.innerHTML = topics
      .map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`)
      .join('');

    const savedTopic = localStorage.getItem('socrates-topic');
    currentTopic = (savedTopic && topics.includes(savedTopic)) ? savedTopic : (topics[0] || '');
    topicSelect.value = currentTopic;
    updateHints(grade, currentTopic);
  } catch (_) {
    // Желі қатесі — сұрыпты тақырыпты сақта
  }
}

// ============================================================
// ОҚИҒА ТЫҢДАУШЫЛАР
// ============================================================
function setupEventListeners() {
  // [DEBUG] Тыңдаушылар қосылып жатыр
  console.log('[DEBUG] setupEventListeners қосылды');
  if (!sendBtn)      console.warn('[DEBUG] sendBtn табылмады — listener қосылмайды!');
  if (!questionInput) console.warn('[DEBUG] questionInput табылмады!');

  // Сынып ауыстыру
  gradeSelect?.addEventListener('change', async () => {
    currentGrade = parseInt(gradeSelect.value);
    localStorage.setItem('socrates-grade', String(currentGrade));
    await loadTopics(currentGrade);
    resetChat();
  });

  // Тақырып ауыстыру
  topicSelect?.addEventListener('change', () => {
    currentTopic = topicSelect.value;
    localStorage.setItem('socrates-topic', currentTopic);
    updateHints(currentGrade, currentTopic);
    resetChat();
  });

  // Жіберу батырмасы
  sendBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    sendQuestion();
  });

  // Enter = жіберу · Shift+Enter = жаңа жол
  questionInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  });

  // Авторесайз
  questionInput?.addEventListener('input', autoResize);

  // Нұсқаулық батырмалары (hint buttons)
  document.querySelectorAll('.hint-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isLoading) return;
      questionInput.value = btn.dataset.hint;
      autoResize();
      questionInput.focus();
      sendQuestion();
    });
  });

  // Жаңа диалог
  newChatBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    resetChat();
  });
}

// ============================================================
// СҰРАҚ ЖІБЕРУ  (SSE стриминг)
// ============================================================
async function sendQuestion() {
  console.log('[DEBUG] sendQuestion вызван');
  const text = questionInput.value.trim();
  if (!text || isLoading) return;

  isLoading           = true;
  sendBtn.disabled    = true;
  questionInput.value = '';
  autoResize();

  addMessage('user', text);
  history.push({ role: 'user', content: text });

  const typingEl    = addTypingIndicator();
  let   aiText      = '';
  let   aiEl        = null;      // бос AI элементін қадағалау (қате болса — жою)
  let   serverError = null;      // SSE арқылы келген сервер қатесі

  // 60 секундтан кейін fetch-ті үзу
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 60_000);

  try {
    // ── 1. Сұраныс мәліметтерін console-ге шығар ──
    const reqBody = {
      grade:    currentGrade,
      topic:    currentTopic || 'Информатика негіздері',
      messages: history,
    };
    console.log('[Сократ] → POST', `${API_URL}/chat`);
    console.log('[Сократ]   grade:', reqBody.grade,
                '| topic:', reqBody.topic,
                '| messages:', reqBody.messages.length);

    const res = await fetch(`${API_URL}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(reqBody),
      signal:  controller.signal,
    });

    // ── 2. HTTP статусын тексер ──
    console.log('[Сократ] ← Response status:', res.status, res.ok ? 'OK' : 'FAIL');

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    // Typing индикаторын алып тастап, бос AI хабарламасын қос
    typingEl.remove();
    aiEl = addMessage('assistant', '');
    const aiTextEl = aiEl.querySelector('.message-text');

    // ── 3. SSE стримін оқу ──
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    outer: while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('[Сократ] Stream closed (done=true)');
        break;
      }

      const raw = decoder.decode(value, { stream: true });
      console.log('[Сократ] SSE chunk raw:', JSON.stringify(raw));
      buffer += raw;

      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;

        const payload = line.slice(6).trim();
        if (payload === '[DONE]') {
          console.log('[Сократ] [DONE] алынды');
          break outer;
        }

        // ── 4. JSON жіктеу: қате мен мәтінді БӨЛЕК өңде ──
        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch (_) {
          console.warn('[Сократ] JSON жіктеу қатесі:', payload);
          continue; // Бұзылған chunk — өткіз
        }

        if (parsed.error) {
          // Сервер қатесін тексер — бұрын мұнда throw ішінде catch болып глоталып кетті!
          console.error('[Сократ] Сервер SSE қатесі:', parsed.error);
          serverError = parsed.error;
          break outer; // Цикілден шығу, outer catch-та өңделеді
        }

        if (parsed.text) {
          aiText += parsed.text;
          console.log('[Сократ] Chunk:', parsed.text.length,
                      'chars | Барлығы:', aiText.length);
          aiTextEl.innerHTML = formatText(aiText);
          scrollToBottom();
        }
      }
    }

    clearTimeout(timeoutId);

    // ── 5. Сервер қатесін лақтыр (цикілден тыс) ──
    if (serverError) {
      throw new Error(serverError);
    }

    if (aiText) {
      history.push({ role: 'assistant', content: aiText });
      // Тарихты 20 хабарламамен шектеу (10 айырбас)
      if (history.length > 20) history = history.slice(-20);
    } else {
      // Бос жауап — бос div қал, қате көрсет
      aiEl?.remove();
      aiEl = null;
      addMessage('assistant', 'AI бос жауап қайтарды. Тақырыпты өзгертіп байқа.', true);
      history.pop();
    }

  } catch (err) {
    clearTimeout(timeoutId);
    typingEl?.remove();
    aiEl?.remove(); // Бос AI хабарламасын жою

    console.error('[Сократ] sendQuestion қатесі:', err.name, '—', err.message);

    const msg = err.name === 'AbortError'
      ? 'Сұраныс уақыты өтті (60 сек). Байланысты тексер.'
      : err.name === 'TypeError'
        ? 'Сервермен байланыс жоқ. localhost:3000 қосулы ма?'
        : `Қате: ${err.message}`;

    addMessage('assistant', msg, true);
    history.pop();

  } finally {
    isLoading        = false;
    sendBtn.disabled = false;
    questionInput.focus();
  }
}

// ============================================================
// ХАБАРЛАМА ЭЛЕМЕНТІН ҚОС
// ============================================================
function addMessage(role, text, isError = false) {
  const isUser = role === 'user';
  const el     = document.createElement('div');

  el.className = `message ${isUser ? 'message-user' : 'message-ai'} msg-enter`;
  el.innerHTML = `
    <div class="message-avatar" aria-hidden="true">${isUser ? 'О' : 'С'}</div>
    <div class="message-content">
      ${!isUser ? '<div class="message-label">Сократ</div>' : ''}
      <div class="message-text${isError ? ' msg-error' : ''}">${
        text ? formatText(text) : ''
      }</div>
    </div>
  `;

  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

// ============================================================
// TYPING ИНДИКАТОРЫ
// ============================================================
function addTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'message message-ai msg-enter';
  el.innerHTML = `
    <div class="message-avatar" aria-hidden="true">С</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

// ============================================================
// МӘТІН ФОРМАТТАУ (XSS-ден қорғалған)
// ============================================================
function formatText(raw) {
  return raw
    // 1. HTML арнайы таңбаларды экрандау
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // 2. Markdown форматтау
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/gs,    '<em>$1</em>')
    .replace(/`([^`]+)`/g,     '<code>$1</code>')
    .replace(/\n/g,             '<br>');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// ЧАТТЫ ТАЗАЛАУ / ЖАҢА ДИАЛОГ
// ============================================================
function resetChat() {
  history      = [];
  const topic  = currentTopic || '—';

  messagesEl.innerHTML = `
    <div class="message message-ai msg-enter">
      <div class="message-avatar" aria-hidden="true">С</div>
      <div class="message-content">
        <div class="message-label">Сократ</div>
        <div class="message-text">
          Жаңа диалог басталды! 🔄<br><br>
          Тақырып: <strong>${escHtml(topic)}</strong><br>
          Осы тақырып бойынша қандай сұрағың бар?
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// УТИЛИТТЕР
// ============================================================
function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
}

function autoResize() {
  if (!questionInput) return;
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 160) + 'px';
}
