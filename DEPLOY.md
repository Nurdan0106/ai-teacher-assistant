# Деплой Сократ

Backend → Railway | Frontend → Netlify

---

## Шаг 0 — Загрузи код на GitHub

```bash
cd socrates-tutor
git init
git add .
git commit -m "Сократ AI-тьютор v1.0"
git remote add origin https://github.com/ТВОЙusername/socrates-tutor.git
git push -u origin main
```

---

## BACKEND → Railway

### 1. Создай проект

1. Зайди на [railway.app](https://railway.app) → **Log In with GitHub**
2. **New Project → Deploy from GitHub repo**
3. Выбери репозиторий `socrates-tutor`
4. **Root Directory** → укажи `backend`
5. Railway автоматически обнаружит `Procfile` и запустит `node server.js`

### 2. Добавь переменные окружения

Railway → твой проект → **Variables → Raw Editor**:

```
ANTHROPIC_API_KEY=sk-ant-твой-ключ-здесь
NODE_ENV=production
PORT=3000
```

### 3. Проверь деплой

После деплоя Railway выдаст URL вида:
`https://socrates-production-xxxx.railway.app`

Проверь:
```bash
curl https://socrates-production-xxxx.railway.app/health
# Ответ: {"status":"ok","model":"claude-sonnet-4-6"}
```

---

## FRONTEND → Netlify

### 1. Замени localhost на Railway URL

В `frontend/app.js` (строка 5):
```javascript
// ДО:
const API_URL = 'http://localhost:3000/api';

// ПОСЛЕ:
const API_URL = 'https://socrates-production-xxxx.railway.app/api';
```

В `frontend/teacher.js` (строка 5):
```javascript
// ДО:
const API_URL = 'http://localhost:3000/api';

// ПОСЛЕ:
const API_URL = 'https://socrates-production-xxxx.railway.app/api';
```

### 2. Задеплой папку frontend

**Способ A — Drag & Drop (1 минута):**
1. Зайди на [netlify.com](https://netlify.com) → Log in
2. Перетащи папку `frontend` прямо на страницу
3. Netlify выдаст URL: `https://socrates-xxxx.netlify.app`

**Способ B — через GitHub (автодеплой):**
1. Netlify → **Add new site → Import an existing project**
2. Выбери GitHub → репозиторий `socrates-tutor`
3. Build command: **(оставь пустым)**
4. Publish directory: `frontend`
5. **Deploy site**

---

## Финальная проверка

| Что проверяем | URL |
|---------------|-----|
| Бэкенд жив | `https://ваш-backend.railway.app/health` |
| Темы загружаются | `https://ваш-backend.railway.app/api/curriculum/8` |
| Главная страница | `https://socrates-xxxx.netlify.app` |
| Кабинет учителя | `https://socrates-xxxx.netlify.app/teacher.html` |
| Чат работает | Отправь вопрос, дождись ответа на казахском |

---

## Бесплатные лимиты

| Сервис | Лимит | Примечание |
|--------|-------|------------|
| Railway | $5 кредит/мес | ~500 часов работы |
| Netlify | 100 GB трафика/мес | Без ограничений для школы |
| Anthropic | Pay-as-you-go | ~$0.01–0.03 за диалог |

---

## Обновление после деплоя

```bash
git add .
git commit -m "Обновление"
git push origin main
# Railway автоматически передеплоит backend
# Netlify (способ B) автоматически передеплоит frontend
```

---

## Troubleshooting

### CORS-ошибки в браузере
Убедись, что в `app.js` и `teacher.js` URL заменён на Railway-адрес.
Сервер настроен на `cors()` (все origins) — ошибка только если URL не тот.

### Timeout при генерации плана урока
Нормально — генерация 2048 токенов занимает 30–60 сек.
Таймаут API установлен на 90 сек.

### stats.json сбрасывается на Railway
Railway использует эфемерное файловое хранилище — файл исчезает при рестарте.
Для постоянной статистики подключи Railway PostgreSQL или MongoDB Atlas.
Для учебного проекта это не критично.

### Как обновить только frontend (без backend)
Измени файлы в `frontend/`, передеплой на Netlify (Drag & Drop снова или `git push`).
Railway не трогай.

### Проверить логи Railway
Railway → твой проект → **Deployments → View Logs**
Там будет виден `console.log` и `console.error` сервера.
