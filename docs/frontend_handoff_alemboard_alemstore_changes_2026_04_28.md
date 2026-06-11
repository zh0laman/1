# Frontend Handoff: AlemBoard + AlemStore Changes

Дата: 2026-04-28

Документ описывает backend-изменения, которые нужно подключить на frontend.

## 1. AlemBoard: несколько исполнителей задачи

### Что изменилось

Задача теперь должна создаваться и обновляться через массив исполнителей:

```json
{
  "assignee_ids": [12, 34, 56]
}
```

Backend сохраняет всех исполнителей в `task_assignees` и возвращает их в `Task.assignee_ids`.

### Create task

```http
POST /api/v1/kanban/tasks
```

Пример:

```json
{
  "board_id": "4be0c1f7-dbb6-4a39-a43f-c64cbcf4c8a1",
  "title": "Подготовить отчет",
  "description": "Собрать данные и согласовать",
  "assignee_ids": [12, 34],
  "priority": "high",
  "due_at": "2026-04-30T12:00:00Z"
}
```

### Update task assignees

```http
PUT /api/v1/kanban/tasks/{task_id}
```

Пример:

```json
{
  "assignee_ids": [12, 34, 56]
}
```

### Frontend action

- Использовать multi-select для исполнителей.
- Отправлять только `assignee_ids`.
- Старое поле `assignee_id` backend еще принимает для совместимости, но frontend лучше не использовать.
- В ответе читать `assignee_ids: number[]`.

## 2. AlemBoard: уведомления по задачам

### Что изменилось

Backend теперь автоматически создает уведомления:

- при создании задачи с исполнителями
- при добавлении нового исполнителя в существующую задачу

Frontend не должен вызывать отдельный endpoint для отправки уведомлений.

### Notification types

```text
kanban_task_created
kanban_task_assigned
```

### Notification metadata

В `GET /api/v1/notifications` в поле `metadata` для этих уведомлений приходит:

```json
{
  "kind": "kanban_task",
  "action": "created",
  "task_id": "5b6f8e91-9d6b-4bf0-a58c-8c460cb6cbef",
  "board_id": "4be0c1f7-dbb6-4a39-a43f-c64cbcf4c8a1",
  "board_name": "AlemBoard",
  "task_title": "Подготовить отчет"
}
```

Для назначения нового исполнителя:

```json
{
  "kind": "kanban_task",
  "action": "assigned",
  "task_id": "5b6f8e91-9d6b-4bf0-a58c-8c460cb6cbef",
  "board_id": "4be0c1f7-dbb6-4a39-a43f-c64cbcf4c8a1",
  "board_name": "AlemBoard",
  "task_title": "Подготовить отчет"
}
```

### Frontend action

- Для `kind=kanban_task` открывать задачу по `task_id`.
- Можно роутить пользователя на board по `board_id`.
- Отображать `title`/`content` из notification как обычный текст уведомления.

## 3. AlemBoard: статистика доски

### Новый endpoint

```http
GET /api/v1/kanban/boards/{board_id}/stats
```

Фильтр периода опциональный:

```http
GET /api/v1/kanban/boards/{board_id}/stats?date_from=2026-04-01&date_to=2026-04-28
```

Поддерживаются форматы:

- `YYYY-MM-DD`
- RFC3339, например `2026-04-01T00:00:00Z`

### Response shape

Backend возвращает один JSON с отдельными блоками статистики:

```json
{
  "board_id": "4be0c1f7-dbb6-4a39-a43f-c64cbcf4c8a1",
  "board_name": "AlemBoard",
  "period": {
    "date_from": "2026-04-01T00:00:00Z",
    "date_to": "2026-04-28T23:59:59.999999999Z"
  },
  "summary": {
    "total_tasks": 40,
    "completed_tasks": 18,
    "active_tasks": 22,
    "overdue_tasks": 5,
    "unassigned_tasks": 2,
    "completion_percent": 45,
    "total_estimate_seconds": 288000,
    "total_spent_seconds": 190000,
    "avg_completion_seconds": 172800
  },
  "by_status": [
    {
      "key": "ГОТОВО",
      "name": "ГОТОВО",
      "count": 18,
      "percent": 45
    }
  ],
  "by_column": [
    {
      "column_id": "7a4e3b4d-0a9d-48b6-95fe-d6a85ecb3f10",
      "key": "TODO",
      "name": "To Do",
      "position": 10,
      "count": 8,
      "percent": 20
    }
  ],
  "by_priority": [
    {
      "key": "high",
      "name": "high",
      "count": 10,
      "percent": 25
    }
  ],
  "by_deadline": [
    {
      "key": "overdue",
      "name": "Просрочено",
      "count": 5,
      "percent": 12.5
    }
  ],
  "employees": [
    {
      "user_id": 12,
      "full_name": "Иван Иванов",
      "assigned_tasks": 10,
      "created_tasks": 3,
      "completed_tasks": 6,
      "active_tasks": 4,
      "overdue_tasks": 1,
      "completion_percent": 60,
      "overdue_percent": 10,
      "total_estimate_seconds": 72000,
      "total_spent_seconds": 65000,
      "worklog_seconds": 65000,
      "productivity_score": 75
    }
  ],
  "activity": [
    {
      "action": "updated",
      "count": 30
    }
  ],
  "worklogs": [
    {
      "date": "2026-04-28",
      "total_seconds": 14400
    }
  ]
}
```

### Значение блоков

- `summary` — общая статистика доски.
- `by_status` — распределение задач по статусам.
- `by_column` — распределение по колонкам доски.
- `by_priority` — распределение по приоритетам.
- `by_deadline` — сроки: `overdue`, `due_today`, `due_week`, `later`, `no_due`, `done`.
- `employees` — статистика и оценка сотрудников.
- `activity` — агрегат по `task_history.action`.
- `worklogs` — списание времени по дням.

### Employee productivity score

`productivity_score` — backend-оценка от `0` до `100`.

Сейчас формула учитывает:

- процент завершенных задач
- процент непросроченных задач
- наличие списанного времени в worklogs

Frontend может показывать score как рейтинг/прогресс, но рядом лучше отображать исходные метрики: `completed_tasks`, `assigned_tasks`, `overdue_tasks`, `worklog_seconds`.

## 4. AlemStore: категории public apps

### Что изменилось

В таблицу `public_apps` добавлено поле:

```text
category TEXT NOT NULL DEFAULT ''
```

API теперь возвращает `category` как хранимое поле. Для старых записей, где категория пустая, backend сохраняет fallback: определяет категорию по названию, ссылке и тегам.

### Категории

Поддерживаемые значения:

```text
ИИ
Документация
Прочие
```

Backend также понимает старые/синонимичные значения в фильтре, но frontend должен использовать новые значения выше.

### List public apps

```http
GET /api/v1/public-apps
```

Фильтр по категории:

```http
GET /api/v1/public-apps?category=ИИ
GET /api/v1/public-apps?category=Документация
GET /api/v1/public-apps?category=Прочие
```

### Create public app

```http
POST /api/v1/public-apps
```

Пример:

```json
{
  "app_name": "AlemGPT",
  "link": "https://example.com",
  "app_photo": "https://example.com/icon.png",
  "web_view": true,
  "is_global": false,
  "is_private": false,
  "category": "ИИ",
  "tags": ["AI", "assistant"]
}
```

### Update public app

```http
PUT /api/v1/public-apps/{id}
```

Пример:

```json
{
  "category": "Документация"
}
```

### PublicApp response

```json
{
  "id": 12,
  "app_name": "AlemGPT",
  "link": "https://example.com",
  "app_photo": "https://example.com/icon.png",
  "web_view": true,
  "position": 1,
  "category": "ИИ",
  "tags": ["AI", "assistant"],
  "average_rating": 4.6,
  "rating_count": 15,
  "favorite_count": 20,
  "is_favorite": true,
  "is_global": false
}
```

### Frontend action

- Добавить category selector при создании/редактировании AlemStore app.
- В списке приложений группировать или фильтровать по `category`.
- Использовать значения `ИИ`, `Документация`, `Прочие`.

## 5. Notes photo upload / presign

### Что изменилось

Backend исправлен для генерации presigned upload URL через MinIO. Это в основном backend/env изменение.

Frontend flow не меняется:

1. `POST /api/v1/notes/{note_id}/attachments/presign`
2. `PUT upload_url`
3. `POST /api/v1/notes/{note_id}/attachments/{attachment_id}/complete`

### Presign request

```json
{
  "mime_type": "image/png",
  "size_bytes": 64898
}
```

### Важно

Если frontend получает `502` от `/attachments/presign`, проверить backend env:

```env
MINIO_REGION=us-east-1
MINIO_ENDPOINT=...
MINIO_PUBLIC_BASE_URL=...
```

## 6. Quick frontend checklist

- AlemBoard task form: заменить single assignee на multi-select.
- AlemBoard task update: отправлять полный массив `assignee_ids`.
- Notifications: обработать `kanban_task_created` и `kanban_task_assigned`.
- Board details: добавить вкладку/экран статистики через `/kanban/boards/{id}/stats`.
- Board stats UI: использовать отдельные блоки response DTO.
- AlemStore app form: добавить поле `category`.
- AlemStore list: добавить фильтр/группировку по `category`.
- Notes upload flow не менять, только учитывать что backend presign должен вернуть working `upload_url`.
