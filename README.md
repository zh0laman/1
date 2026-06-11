# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

# 🤖 RAG Чат-бот платформа (Бэкенд & Фронтенд)

В проект добавлена multi-tenant чат-бот RAG-система, состоящая из Python бэкенда (FastAPI) и интегрированной админ-панели на React во фронтенде.

## 🛠️ Описание реализации

### 1. Бэкенд (`backend/`):
- **FastAPI**: асинхронный веб-фреймворк на Python.
- **SQLAlchemy 2.0 (asyncpg)**: асинхронное взаимодействие с базой данных.
- **Alembic**: управление миграциями базы данных.
- **PostgreSQL 16 (pgvector)**: база данных с поддержкой векторных операций и эмбеддингов.
- **JWT**: авторизация пользователей с разграничением ролей (`owner`, `admin`, `viewer`).
- **Бbcrypt**: Прямое хеширование и валидация паролей (решена проблема совместимости `passlib` с Python 3.13).

### 2. Фронтенд (`src/`):
Интеграция новых страниц администрирования в соответствии с Clean Architecture проекта:
- **Слой Domain**:
  - `src/domain/entities/bot.ts` & `src/domain/entities/rag-auth.ts` — типизация сущностей.
  - `src/domain/repositories/BotAdminRepository.ts` — интерфейс репозитория ботов.
- **Слой Infrastructure**:
  - `src/infrastructure/repositories/HttpBotAdminRepository.ts` — HTTP-клиент для взаимодействия с API ботов.
  - `src/infrastructure/auth/ragAuthApi.ts` — авторизация в RAG платформе с хранением токена в `localStorage`.
- **Слой Presentation**:
  - `src/presentation/pages/bot-admin/RagLoginPage.tsx` — страница входа/регистрации (тёмная тема, стеклянный эффект, анимации `framer-motion`).
  - `src/presentation/pages/bot-admin/BotAdminPage.tsx` — панель администрирования со списком ботов, строкой поиска, карточками и действиями управления.
  - `src/presentation/pages/bot-admin/BotFormModal.tsx` — модальное окно создания/редактирования бота с настройками параметров LLM (температура, лимит токенов).
  - `src/presentation/pages/bot-admin/RagProtectedRoute.tsx` — роут-гард для защиты админ-панелей.
- **Конфигурация & Роутинг**:
  - `src/App.tsx` — добавлены пути `/rag-admin/login` и `/rag-admin/bots`.
  - `vite.config.ts` — добавлен Vite Proxy для перенаправления запросов `/rag-api` на бэкенд RAG платформы (`http://localhost:8000`).

---

## 🚀 Инструкция по запуску

### 1. Запуск базы данных
В каталоге `backend/` запустите Docker Compose (порт базы данных `5434` во избежание коллизий на хосте):
```bash
cd backend
docker compose up -d db
```

### 2. Запуск бэкенда
Вы можете запустить бэкенд локально с использованием виртуального окружения:
```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. alembic upgrade head
uvicorn app.main:app --port 8000 --reload
```

*Документация API (Swagger UI) доступна на: http://localhost:8000/docs*

### 3. Запуск фронтенда
```bash
# В корне проекта alem-superapp-front/
npm install
npm run dev
```

Откройте в браузере: `http://localhost:5173/web/rag-admin/login`

---

## 🔑 Примеры cURL запросов

1. **Регистрация пользователя (Owner)**:
   ```bash
   curl -X POST http://127.0.0.1:8000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@alem.kz","password":"password123","full_name":"Admin User","tenant_name":"Alem Workspace"}'
   ```
2. **Вход и получение JWT-токена**:
   ```bash
   curl -X POST http://127.0.0.1:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@alem.kz","password":"password123"}'
   ```
3. **Создание нового бота** (с использованием токена):
   ```bash
   curl -X POST http://127.0.0.1:8000/admin/bots \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -d '{"name":"Alem Helper","description":"A helpful RAG bot","system_prompt":"You are a helpful assistant.","settings":{"temperature":0.7,"max_tokens":1000}}'
   ```
