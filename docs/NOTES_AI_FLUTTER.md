# AI Tools API for Flutter

Этот документ описывает AI API, которые Flutter-клиент может использовать в приложении:

- `POST /tools/notes-ai/proofread`
- `POST /tools/notes-ai/summarize`
- `POST /tools/tzai/task-assist`
- `GET /tools/kanban/boards/{board_id}/stats`

Документ написан как прикладной integration guide для мобильной команды.

## 1. Base URL

Пример:

```text
http://100.72.193.178:18002
```

## 2. Авторизация

Все ручки требуют JWT токен пользователя:

```http
Authorization: Bearer <GO_JWT_TOKEN>
```

Для `POST` ручек также нужен:

```http
Content-Type: application/json
```

## 3. Интеграция Alem Drive (OnlyOffice WebView)

Для открытия документов в мобильном приложении используйте WebView. Чтобы пользователь не логинился повторно и интерфейс был чистым, используйте следующие параметры.

### Формат ссылки:
```text
http://100.72.193.178:8082/drive/editor/[FILE_ID]?embedded=true&token=[USER_TOKEN]
```

*   **token**: Передайте JWT токен пользователя. Система автоматически авторизует его.
*   **embedded=true**: Убирает шапку сайта и заголовок редактора (максимум места под документ).

## 4. Список ручек (AI)

### Notes AI

- `POST /tools/notes-ai/proofread`
- `POST /tools/notes-ai/summarize`

### Task AI Helper

- `POST /tools/tzai/task-assist`

### Kanban Board Stats

- `GET /tools/kanban/boards/{board_id}/stats`

---

## 4. Notes AI: Proofread

### Endpoint

```text
POST /tools/notes-ai/proofread
```

### Назначение

Используется для:

- исправления орфографии
- исправления пунктуации
- легкой правки формулировок
- сохранения исходного смысла текста

### Request Body

Можно передать либо:

- `content` - обычный текст заметки
- `content_doc` - rich note JSON

Также можно опционально передать:

- `model`

### Пример request

```json
{
  "content": "сегодня мы обсуждали релиз и решили что надо обновить мобилку"
}
```

### Пример response

```json
{
  "tool": "notes_ai_proofread",
  "original_text": "сегодня мы обсуждали релиз и решили что надо обновить мобилку",
  "corrected_text": "Сегодня мы обсуждали релиз и решили, что нужно обновить мобильное приложение.",
  "change_summary": [
    "Исправлена пунктуация",
    "Улучшены формулировки без изменения смысла"
  ]
}
```

### Поля ответа

- `tool` - идентификатор инструмента
- `original_text` - текст, который реально анализировался
- `corrected_text` - исправленный вариант текста
- `change_summary` - список коротких пояснений по улучшениям

### Как использовать во Flutter

Рекомендуемый сценарий:

1. Пользователь нажимает кнопку `Исправить текст`
2. Flutter отправляет текущий `content` или `content_doc`
3. Показывается loader
4. После ответа:
   - показать `corrected_text`
   - ниже показать `change_summary`
5. Дать действие:
   - `Заменить текст`
   - `Отмена`

### Curl

```bash
curl -X POST "http://92.38.48.9:18002/tools/notes-ai/proofread" \
  -H "Authorization: Bearer <GO_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "сегодня мы обсуждали релиз и решили что надо обновить мобилку"
  }'
```

---

## 5. Notes AI: Summarize

### Endpoint

```text
POST /tools/notes-ai/summarize
```

### Назначение

Используется для:

- получения краткого резюме заметки
- построения короткой выжимки для preview
- получения списка ключевых мыслей

### Request Body

Можно передать либо:

- `content`
- `content_doc`

### Пример request

```json
{
  "content": "Сегодня обсуждали релиз, обновление мобильного приложения и следующие шаги команды."
}
```

### Пример response

```json
{
  "tool": "notes_ai_summarize",
  "source_text": "Сегодня обсуждали релиз, обновление мобильного приложения и следующие шаги команды.",
  "summary": "Обсуждался релиз и обновление мобильного приложения. Также были зафиксированы дальнейшие шаги команды.",
  "bullets": [
    "Обсудили релиз",
    "Нужно обновить мобильное приложение",
    "Определены следующие шаги команды"
  ]
}
```

### Поля ответа

- `tool` - идентификатор инструмента
- `source_text` - текст, который реально использовался
- `summary` - короткое резюме
- `bullets` - ключевые мысли

### Как использовать во Flutter

Рекомендуемый сценарий:

1. Пользователь нажимает кнопку `Сделать резюме`
2. Flutter отправляет текущий `content` или `content_doc`
3. Показывается loader
4. После ответа:
   - показать `summary`
   - ниже показать `bullets`
5. Дальше можно:
   - вставить summary в preview
   - отобразить как bottom sheet
   - использовать как краткое описание note

### Curl

```bash
curl -X POST "http://92.38.48.9:18002/tools/notes-ai/summarize" \
  -H "Authorization: Bearer <GO_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Сегодня обсуждали релиз, обновление мобильного приложения и следующие шаги команды."
  }'
```

---

## 6. Task AI Helper

### Endpoint

```text
POST /tools/tzai/task-assist
```

### Назначение

Используется в форме создания задачи, когда пользователь пишет короткую мысль, а система помогает подготовить нормальное описание задачи.

Этот endpoint:

- не создает задачу
- не отправляет задачу в Kanban
- не назначает исполнителя

Он только возвращает AI-черновик для заполнения формы.

### Request Body

```json
{
  "text": "Нужно добавить кнопку ИИ помощник в форме создания задачи. Пользователь вводит краткую логику, а система помогает заполнить описание задачи.",
  "title": "ИИ помощник для задачи"
}
```

### Пример response

```json
{
  "tool": "tzai_task_assist",
  "suggested_title": "ИИ помощник для задачи",
  "description": "Подробное описание задачи...\n\nКритерии приемки:\n- ...\n- ...",
  "acceptance_criteria": [
    "Критерий 1",
    "Критерий 2"
  ]
}
```

### Поля ответа

- `tool` - идентификатор инструмента
- `suggested_title` - предлагаемый title задачи
- `description` - готовый черновик описания для textarea
- `acceptance_criteria` - отдельный список критериев приемки

### Как использовать во Flutter

Рекомендуемый сценарий:

1. Пользователь в форме создания задачи нажимает `ИИ помощник`
2. Flutter отправляет краткий текст задачи в `text`
3. Показывается loader
4. После ответа:
   - если поле title пустое, можно подставить `suggested_title`
   - в description textarea подставить `description`
   - `acceptance_criteria` можно отобразить отдельным списком
5. Финальное создание задачи выполняется другой ручкой Kanban

### Curl

```bash
curl --location 'http://92.38.48.9:18002/tools/tzai/task-assist' \
  --header 'accept: application/json' \
  --header 'Authorization: Bearer <GO_JWT_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "text": "Нужно добавить кнопку ИИ помощник в форме создания задачи. Пользователь вводит краткую логику, а система помогает заполнить описание задачи.",
    "title": "ИИ помощник для задачи"
  }'
```

---

## 7. Kanban Board Stats

### Endpoint

```text
GET /tools/kanban/boards/{board_id}/stats
```

Пример:

```text
GET /tools/kanban/boards/2267bdb6-ba81-4042-950d-b3f7d72a4ab7/stats
```

### Назначение

Используется для экрана статистики по доске.

Ручка возвращает:

- summary по доске
- список пользователей с показателями
- timeline по дням
- AI-комментарии по сотрудникам

### Что возвращается по смыслу

#### `summary`

Сводные цифры по доске:

- `total_tasks`
- `done_tasks`
- `in_progress_tasks`
- `overdue_tasks`
- `closed_this_month`

#### `users`

Список сотрудников со статистикой:

- `full_name`
- `assigned_tasks_count`
- `closed_tasks_count`
- `share_percent`
- `in_progress_tasks_count`
- `overdue_tasks_count`
- `on_time_closed_count`
- `late_closed_count`
- `total_time_spent_sec`
- `updated_this_week_count`
- `updated_previous_week_count`
- `weekly_delta_count`
- `commentary`
- `ai_summary`
- `tasks`

#### `timeline`

Массив точек по дням:

- `date`
- `closed_tasks_count`

### Пример response

```json
{
  "tool": "kanban_board_stats",
  "board_id": "2267bdb6-ba81-4042-950d-b3f7d72a4ab7",
  "board_name": "Alem SuperApp for developers",
  "done_column_id": "6a0074c0-4bf9-4f6d-bb84-0da4d71ce338",
  "stats_mode": "workflow",
  "timeline_metric": "closed_tasks",
  "period_start": "2026-04-01",
  "period_end": "2026-04-30",
  "total_closed_tasks": 12,
  "summary": {
    "total_tasks": 164,
    "done_tasks": 20,
    "in_progress_tasks": 14,
    "overdue_tasks": 19,
    "closed_this_month": 12
  },
  "users": [
    {
      "user_id": 9,
      "full_name": "Султан",
      "assigned_tasks_count": 8,
      "closed_tasks_count": 3,
      "share_percent": 25.0,
      "in_progress_tasks_count": 2,
      "overdue_tasks_count": 1,
      "on_time_closed_count": 2,
      "late_closed_count": 1,
      "total_time_spent_sec": 14400,
      "updated_this_week_count": 5,
      "updated_previous_week_count": 3,
      "weekly_delta_count": 2,
      "commentary": "Закрыл 3 задачи, держит 2 в работе, есть 1 просроченная задача.",
      "ai_summary": "За выбранный период Султан закрыл 3 задачи. Активность выше, чем на прошлой неделе, и сейчас у него 2 задачи в работе.",
      "tasks": []
    }
  ],
  "timeline": [
    {
      "date": "2026-04-01",
      "closed_tasks_count": 1
    }
  ],
  "calculation_note": "..."
}
```

### Как использовать во Flutter

Рекомендуемый сценарий экрана:

1. Верхний блок `summary cards`
   - всего задач
   - done
   - in progress
   - overdue
   - closed this month

2. Ниже `users list`
   - имя сотрудника
   - closed count
   - share percent
   - overdue count
   - AI summary

3. Ниже `timeline chart`
   - количество закрытий по дням

### Важные поля для UI

- `stats_mode`
  - `workflow`
  - `heuristic`
  - `activity_fallback`

- `timeline_metric`
  - `closed_tasks`
  - `updated_tasks`

Это важно показывать или учитывать в логике, потому что на кастомных досках статистика может считаться не строго по `DONE`, а по activity fallback.

### Curl

```bash
curl --location 'http://92.38.48.9:18002/tools/kanban/boards/2267bdb6-ba81-4042-950d-b3f7d72a4ab7/stats' \
  --header 'accept: application/json' \
  --header 'Authorization: Bearer <GO_JWT_TOKEN>'
```

---

## 8. Rich note JSON

Если заметка хранится как rich JSON, можно передавать `content_doc`.

Пример:

```json
{
  "content_doc": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "Сегодня обсуждали релиз и план следующих задач"
          }
        ]
      }
    ]
  }
}
```

Если переданы и `content`, и `content_doc`, backend сначала использует `content`.

## 9. Что AI backend НЕ делает

### Notes AI

Эти ручки:

- не создают заметку
- не обновляют заметку
- не сохраняют результат в `alem-back`

### Task AI Helper

Эта ручка:

- не создает задачу
- не сохраняет задачу в Kanban
- только готовит draft для формы

### Board Stats

Эта ручка:

- не меняет данные доски
- только читает board data и строит статистику

## 10. Error handling

При ошибке backend вернет стандартный error response.

Пример:

```json
{
  "detail": "Failed to summarize note: ..."
}
```

Рекомендуется:

- показать snackbar / alert
- не затирать текущие данные в форме
- дать пользователю повторить запрос

## 11. Рекомендуемый минимум для первой версии Flutter

### Для notes

- кнопка `Исправить текст`
- кнопка `Сделать резюме`

### Для task creation

- кнопка `ИИ помощник`
- автоподстановка `description`

### Для board analytics

- экран статистики
- summary cards
- список сотрудников
- AI summary по сотруднику

## 12. Коротко

- `notes-ai/proofread` = исправить текст заметки
- `notes-ai/summarize` = сделать резюме заметки
- `tzai/task-assist` = помочь заполнить описание задачи
- `kanban/boards/{board_id}/stats` = показать статистику по доске и сотрудникам
