# CHAT HISTORY FRONTEND API

## Назначение

Этот документ описывает, как фронту загружать историю чата по частям, а не тянуть весь чат целиком.

Цель UX:

- при открытии чата сразу показать последние сообщения
- не грузить всю историю одним запросом
- догружать старые сообщения вверх по скроллу
- корректно работать с `unread_count`
- корректно совмещать REST-пагинацию и WebSocket

Текущая реализация backend работает **через `limit + offset`**, без cursor pagination.

Важно:

- сообщения из API истории приходят **от новых к старым**
- для красивого UI как в Telegram фронт обычно рендерит их **от старых к новым**
- значит полученный массив почти всегда надо **развернуть перед отрисовкой**

---

## Коротко: как фронту грузить чат правильно

### Рекомендуемый flow

1. На списке чатов взять чат из `GET /api/v1/chats/unified`
2. При открытии чата запросить первую страницу:

```http
GET /api/v1/conversations/:conversation_id/messages?limit=50&offset=0
```

или для группы:

```http
GET /api/v1/groups/:group_id/messages?limit=50&offset=0
```

3. Backend вернет **последние 50 сообщений**, начиная с самых новых
4. На клиенте развернуть массив в порядок `oldest -> newest`
5. Поставить скролл вниз, на конец списка
6. Когда пользователь скроллит вверх, догружать старые сообщения:

```http
GET ...?limit=50&offset=50
GET ...?limit=50&offset=100
GET ...?limit=50&offset=150
```

7. Новые входящие сообщения получать по WebSocket и добавлять в конец UI
8. Для старых страниц делать `dedupe` по `message.id`, потому что при offset-пагинации и живом чате возможны дубли

---

## Какие endpoints нужны фронту

### 1. Список чатов

#### Единый список всех чатов

```http
GET /api/v1/chats/unified?limit=50&offset=0
```

Возвращает **массив**, не объект:

```json
[
  {
    "id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
    "type": "personal",
    "peer_id": 52,
    "peer_username": "a.saparov",
    "peer_full_name": "Айдын Сапаров",
    "peer_avatar": "https://cdn.example.com/avatar-52.jpg",
    "last_seen_at": "2026-04-01T09:10:15Z",
    "last_message": {
      "id": "37c2035e-aaaa-bbbb-cccc-8d95e6ee4001",
      "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
      "sender_id": 52,
      "content": "Скинул документы",
      "type": "text",
      "is_edited": false,
      "is_deleted": false,
      "created_at": "2026-04-01T09:11:00Z",
      "updated_at": "2026-04-01T09:11:00Z",
      "sender_username": "a.saparov",
      "sender_full_name": "Айдын Сапаров",
      "sender_avatar": "https://cdn.example.com/avatar-52.jpg",
      "is_read": false,
      "reactions": null
    },
    "unread_count": 3,
    "mention_count": 0,
    "is_pinned": false,
    "is_muted": false,
    "created_at": "2026-03-20T10:00:00Z",
    "updated_at": "2026-04-01T09:11:00Z"
  },
  {
    "id": "91f90940-2222-5555-8888-07b598a09b2a",
    "type": "group",
    "group_id": "91f90940-2222-5555-8888-07b598a09b2a",
    "group_name": "Пресс-служба",
    "group_avatar": "https://cdn.example.com/group-1.jpg",
    "last_message": {
      "id": "601ece8d-dddd-eeee-ffff-7626f9f71002",
      "conversation_id": "91f90940-2222-5555-8888-07b598a09b2a",
      "sender_id": 17,
      "content": "Файл",
      "type": "file",
      "is_edited": false,
      "is_deleted": false,
      "created_at": "2026-04-01T08:58:00Z",
      "updated_at": "2026-04-01T08:58:00Z",
      "sender_username": "m.admin",
      "sender_full_name": "Мадина Админ",
      "sender_avatar": null,
      "is_read": false,
      "reactions": null
    },
    "unread_count": 7,
    "mention_count": 2,
    "is_pinned": true,
    "is_muted": false,
    "created_at": "2026-03-15T14:00:00Z",
    "updated_at": "2026-04-01T08:58:00Z"
  }
]
```

Что фронту брать отсюда:

- `id`
- `type`
- `unread_count`
- `mention_count`
- `last_message`
- `peer_*` для лички
- `group_*` для группы

Важно:

- `GET /api/v1/chats/unified` возвращает **массив**
- `GET /api/v1/conversations` и `GET /api/v1/groups` возвращают **объекты с `count`**

---

## Загрузка истории личного чата

### Endpoint

```http
GET /api/v1/conversations/:conversation_id/messages?limit=50&offset=0
```

### Query params

- `limit`
  - по умолчанию `50`
  - максимум `100`
- `offset`
  - по умолчанию `0`
  - первая страница всегда `0`

### Пример curl

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/conversations/4b3b7a8d-1111-4444-9999-16a6047c2f11/messages?limit=50&offset=0" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Пример ответа

```json
{
  "messages": [
    {
      "id": "9d38d871-1000-4000-8000-f1f110000001",
      "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
      "sender_id": 52,
      "reply_to_id": null,
      "content": "Последнее сообщение в чате",
      "content_hash": "",
      "type": "text",
      "attachment_url": null,
      "attachment_type": null,
      "attachment_size": null,
      "metadata": null,
      "is_edited": false,
      "is_forwarded": false,
      "original_sender_id": null,
      "is_deleted": false,
      "created_at": "2026-04-01T09:11:00Z",
      "updated_at": "2026-04-01T09:11:00Z",
      "edited_at": null,
      "is_ephemeral": false,
      "ttl_seconds": null,
      "expires_at": null,
      "sender_username": "a.saparov",
      "sender_full_name": "Айдын Сапаров",
      "sender_avatar": "https://cdn.example.com/avatar-52.jpg",
      "original_sender_full_name": null,
      "reply_to": null,
      "read_by_count": 1,
      "delivered_count": 1,
      "is_read": false,
      "reactions": []
    },
    {
      "id": "9d38d871-1000-4000-8000-f1f110000000",
      "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
      "sender_id": 11,
      "reply_to_id": "8b58d871-1000-4000-8000-f1f110000099",
      "content": "Ок, принял",
      "content_hash": "",
      "type": "text",
      "attachment_url": null,
      "attachment_type": null,
      "attachment_size": null,
      "metadata": null,
      "is_edited": false,
      "is_forwarded": false,
      "original_sender_id": null,
      "is_deleted": false,
      "created_at": "2026-04-01T09:10:12Z",
      "updated_at": "2026-04-01T09:10:12Z",
      "edited_at": null,
      "is_ephemeral": false,
      "ttl_seconds": null,
      "expires_at": null,
      "sender_username": "i.ivanov",
      "sender_full_name": "Иван Иванов",
      "sender_avatar": "https://cdn.example.com/avatar-11.jpg",
      "original_sender_full_name": null,
      "reply_to": {
        "id": "8b58d871-1000-4000-8000-f1f110000099",
        "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
        "sender_id": 52,
        "reply_to_id": null,
        "content": "Проверь, пожалуйста",
        "type": "text",
        "attachment_url": null,
        "attachment_type": null,
        "attachment_size": null,
        "metadata": null,
        "is_edited": false,
        "is_deleted": false,
        "created_at": "2026-04-01T09:09:45Z",
        "updated_at": "2026-04-01T09:09:45Z",
        "edited_at": null,
        "sender_username": "a.saparov",
        "sender_full_name": "Айдын Сапаров",
        "sender_avatar": "https://cdn.example.com/avatar-52.jpg",
        "read_by_count": 0,
        "delivered_count": 0,
        "is_read": false,
        "reactions": null
      },
      "read_by_count": 1,
      "delivered_count": 1,
      "is_read": true,
      "reactions": [
        {
          "reaction": "👍",
          "count": 1,
          "users": [
            {
              "id": 52,
              "full_name": "Айдын Сапаров",
              "avatar": "https://cdn.example.com/avatar-52.jpg"
            }
          ],
          "reacted": false
        }
      ]
    }
  ],
  "count": 2
}
```

### Что важно по личке

- backend возвращает сообщения **по `created_at DESC`**
- первое сообщение в массиве это **самое новое**
- `count` это **размер текущей страницы**, а не общее количество сообщений в чате
- если фронт открыл чат с `offset=0`, backend **сбрасывает badge `unread_count` для личного чата**

Важно:

- это сбрасывает домашний badge списка чатов
- но для read receipt и единообразия фронту все равно лучше вызывать `POST /api/v1/messages/:message_id/read` по последнему реально просмотренному входящему сообщению

---

## Загрузка истории группы

### Endpoint

```http
GET /api/v1/groups/:group_id/messages?limit=50&offset=0
```

### Пример curl

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/groups/91f90940-2222-5555-8888-07b598a09b2a/messages?limit=50&offset=0" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Пример ответа

```json
{
  "messages": [
    {
      "id": "601ece8d-dddd-eeee-ffff-7626f9f71002",
      "conversation_id": "91f90940-2222-5555-8888-07b598a09b2a",
      "sender_id": 17,
      "reply_to_id": null,
      "content": "https://cdn.example.com/files/brief.pdf",
      "content_hash": "",
      "type": "file",
      "attachment_url": "https://cdn.example.com/files/brief.pdf",
      "attachment_type": "application/pdf",
      "attachment_size": 248000,
      "metadata": "{\"mentions\":[\"a.saparov\"]}",
      "is_edited": false,
      "is_forwarded": false,
      "original_sender_id": null,
      "is_deleted": false,
      "created_at": "2026-04-01T08:58:00Z",
      "updated_at": "2026-04-01T08:58:00Z",
      "edited_at": null,
      "is_ephemeral": false,
      "ttl_seconds": null,
      "expires_at": null,
      "sender_username": "m.admin",
      "sender_full_name": "Мадина Админ",
      "sender_avatar": null,
      "original_sender_full_name": null,
      "reply_to": null,
      "read_by_count": 4,
      "delivered_count": 4,
      "is_read": false,
      "reactions": []
    }
  ],
  "count": 1
}
```

### Что важно по группе

- backend тоже возвращает сообщения **от новых к старым**
- `count` это тоже **количество элементов в этой странице**
- в группах `unread_count` считается по `message_status`, а не отдельным счетчиком
- просто запрос `GET /groups/:id/messages` **не гарантирует полное read-state обновление**

Итог:

- для групп фронту обязательно нужен `POST /api/v1/messages/:message_id/read`
- лучше отмечать как прочитанное **последнее видимое входящее сообщение**

---

## Как отмечать сообщения прочитанными

### Endpoint

```http
POST /api/v1/messages/:message_id/read
```

Этот endpoint помечает прочитанными **все сообщения до указанного `message_id` включительно** внутри чата.

### Пример curl

```bash
curl --request POST \
  --url "http://localhost:8080/api/v1/messages/9d38d871-1000-4000-8000-f1f110000001/read" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Успешный ответ

```json
{
  "message": "marked as read"
}
```

### Как фронту вызывать правильно

Рекомендация:

- не дергать этот endpoint на каждый пиксель скролла
- вызывать, когда пользователь реально увидел нижнюю часть чата
- передавать **последнее видимое входящее сообщение**

Практический вариант:

1. Открыли чат
2. Загрузили `offset=0`
3. Отрисовали последние сообщения
4. Нашли последнее входящее сообщение, которое реально попало в viewport
5. Один раз вызвали `POST /messages/:message_id/read`

---

## Telegram-like стратегия для фронта

## 1. Что хранить в состоянии

Рекомендуемый state:

- `messagesById: Record<string, Message>`
- `orderedIds: string[]`
- `historyOffset: number`
- `pageSize: number`
- `hasMore: boolean`
- `isInitialLoading: boolean`
- `isLoadingOlder: boolean`
- `isAtBottom: boolean`
- `pendingNewMessages: number`

Рекомендуемый порядок в UI:

- хранить `orderedIds` в формате **от старых к новым**
- новые сообщения добавлять в конец
- старые страницы добавлять в начало

## 2. Первый вход в чат

Алгоритм:

1. Узнать тип чата: `personal` или `group`
2. Взять `unread_count` из списка чатов
3. Запросить первую страницу `limit=50&offset=0`
4. Получить массив в порядке `newest -> oldest`
5. Развернуть его в `oldest -> newest`
6. Поставить `historyOffset = 50` или `historyOffset += response.count`
7. Если `response.count < limit`, значит старых сообщений больше нет
8. После первой отрисовки проскроллить вниз

## 3. Догрузка старых сообщений вверх

Когда пользователь дошел почти до верха:

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/conversations/4b3b7a8d-1111-4444-9999-16a6047c2f11/messages?limit=50&offset=50" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

Следующий запрос:

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/conversations/4b3b7a8d-1111-4444-9999-16a6047c2f11/messages?limit=50&offset=100" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

Что делать на фронте:

- получить страницу в порядке `newest -> oldest`
- развернуть в `oldest -> newest`
- добавить в начало списка
- сохранить текущую визуальную позицию скролла
- после вставки компенсировать scroll offset, чтобы экран не прыгал

### Важный нюанс по offset

`historyOffset` должен означать:

- **сколько сообщений уже было запрошено у backend по страницам**
- а не сколько уникальных сообщений сейчас лежит в локальном списке

Почему это важно:

- во время открытого чата могут прийти новые сообщения по WebSocket
- из-за этого при следующем `offset` backend может вернуть несколько дублей

Правильное правило:

- сделали запрос `offset=50&limit=50`
- получили `count=50`
- значит следующий `offset = 100`
- даже если 2-3 сообщения оказались дублями и после `dedupe` реально добавилось меньше

## 4. Почему нужен dedupe

Backend сейчас работает на `offset` по живому набору сообщений.

Это значит:

- при новых входящих сообщениях между страницами возможны дубли
- при удалениях и других изменениях возможны смещения

Что делать фронту:

- всегда мерджить историю по `message.id`
- не вставлять одинаковый `message.id` дважды

Это обязательное требование для стабильного UX.

---

## WebSocket: что совмещать с пагинацией

### 1. Новое сообщение

Тип события:

```json
{
  "type": "new_message",
  "to": 11,
  "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
  "message_id": "9d38d871-1000-4000-8000-f1f110000001",
  "content": {
    "id": "9d38d871-1000-4000-8000-f1f110000001",
    "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
    "sender_id": 52,
    "content": "Новое сообщение",
    "type": "text",
    "created_at": "2026-04-01T09:11:00Z",
    "sender_username": "a.saparov",
    "sender_full_name": "Айдын Сапаров",
    "sender_avatar": "https://cdn.example.com/avatar-52.jpg",
    "reply_to": null,
    "read_by_count": 0,
    "delivered_count": 0,
    "is_read": false,
    "reactions": []
  },
  "is_mention": false,
  "timestamp": 1775034660
}
```

Как обрабатывать:

- если открыт именно этот чат:
  - добавить сообщение в конец UI
  - если пользователь внизу, проскроллить вниз
  - если пользователь читает старую историю, не прыгать вниз, а показать badge `Новые сообщения`
- если открыт другой чат:
  - обновить чат-лист
  - увеличить badge этого чата

### 2. Read receipt

```json
{
  "type": "read_receipt",
  "from": 52,
  "to": 11,
  "message_id": "9d38d871-1000-4000-8000-f1f110000001",
  "timestamp": 1775034670
}
```

Как трактовать:

- `from` это пользователь, который прочитал сообщение
- `message_id` это сообщение, до которого дошло чтение

### 3. Редактирование сообщения

```json
{
  "type": "message_edited",
  "to": 11,
  "content": {
    "id": "9d38d871-1000-4000-8000-f1f110000001",
    "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
    "content": "Обновленный текст",
    "type": "text",
    "is_edited": true
  },
  "timestamp": 1775034680
}
```

### 4. Удаление сообщения

```json
{
  "type": "message_deleted",
  "to": 11,
  "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
  "message_id": "9d38d871-1000-4000-8000-f1f110000001",
  "content": {
    "is_for_everyone": false,
    "new_last_message": null
  },
  "timestamp": 1775034690
}
```

### 5. Обновление реакций

```json
{
  "type": "message_reactions_updated",
  "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
  "message_id": "9d38d871-1000-4000-8000-f1f110000001",
  "content": {
    "message_id": "9d38d871-1000-4000-8000-f1f110000001",
    "reactions": [
      {
        "reaction": "👍",
        "count": 2,
        "users": [
          {
            "id": 52,
            "full_name": "Айдын Сапаров",
            "avatar": null
          }
        ],
        "reacted": true
      }
    ]
  },
  "timestamp": 1775034700
}
```

---

## Как сделать поведение "красиво как в Telegram"

### Что делать обязательно

- открывать чат с **последних сообщений**, а не с начала истории
- загружать первую страницу `50` сообщений
- при скролле вверх догружать еще `50`
- сохранять позицию скролла при prepend старых сообщений
- новые сообщения не должны ломать позицию, если пользователь читает старую историю
- показывать плавающую кнопку `вниз` или `N новых сообщений`, если юзер не внизу

### Что не надо делать

- не грузить весь чат целиком
- не делать `offset` равным длине локального уникального массива
- не скроллить вниз насильно, если пользователь листает вверх

### Практические рекомендации по page size

- `30` если мобильный экран и тяжелые ячейки
- `50` оптимальный дефолт
- `100` использовать осторожно, только если нужен быстрый initial fill

---

## Enum'ы и поля, которые фронту нужно понимать

### Chat type

- `personal`
- `group`
- `support`

### Message type

Чаще всего на загрузке истории приходят:

- `text`
- `image`
- `video`
- `file`
- `audio`
- `voice`
- `video_message`

Дополнительно в истории могут встретиться сообщения, созданные сервером/шарингом:

- `share_task`
- `share_event`

### Поля `MessageView`

- `id`
- `conversation_id`
- `sender_id`
- `content`
- `type`
- `attachment_url`
- `attachment_type`
- `attachment_size`
- `metadata`
- `reply_to`
- `is_edited`
- `is_forwarded`
- `is_deleted`
- `created_at`
- `sender_username`
- `sender_full_name`
- `sender_avatar`
- `read_by_count`
- `delivered_count`
- `is_read`
- `reactions`
- `is_ephemeral`
- `ttl_seconds`
- `expires_at`

---

## Ограничения текущего backend

Сейчас backend **не умеет**:

- отдавать историю по cursor
- отдавать сообщения `before_id` или `after_id`
- отдавать сообщения "вокруг конкретного message_id"
- отдавать `total_count` истории
- отдавать `first_unread_message_id`

Следствие для фронта:

- `hasMore` лучше считать как `response.count == limit`
- идеально открыть чат ровно на границе непрочитанных, как в Telegram, сейчас нельзя
- открыть "вниз, к последним" можно нормально

---

## Реальные ошибки

Формат ошибок у API такой:

```json
{
  "error": {
    "code": "NOT_PARTICIPANT",
    "message": "You are not a participant of this chat",
    "details": null
  }
}
```

### Пример: не участник личного чата

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/conversations/4b3b7a8d-1111-4444-9999-16a6047c2f11/messages?limit=50&offset=0" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

```json
{
  "error": {
    "code": "NOT_PARTICIPANT",
    "message": "You are not a participant of this chat",
    "details": null
  }
}
```

### Пример: не участник группы

```json
{
  "error": {
    "code": "NOT_GROUP_MEMBER",
    "message": "You are not a member of this group",
    "details": null
  }
}
```

### Пример: невалидный UUID

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "invalid conversation ID",
    "details": null
  }
}
```

### Пример: невалидные query params

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid query parameters",
    "details": null
  }
}
```

### Пример: сообщение не найдено при read

```json
{
  "error": {
    "code": "MESSAGE_NOT_FOUND",
    "message": "Message not found",
    "details": null
  }
}
```

---

## Рекомендуемая реализация на фронте

```ts
type ChatHistoryState = {
  orderedIds: string[]; // oldest -> newest
  messagesById: Record<string, MessageView>;
  historyOffset: number;
  pageSize: number;
  hasMore: boolean;
};

async function loadInitialChat(chatId: string, kind: "personal" | "group") {
  const pageSize = 50;
  const data = kind === "personal"
    ? await api.get(`/conversations/${chatId}/messages?limit=${pageSize}&offset=0`)
    : await api.get(`/groups/${chatId}/messages?limit=${pageSize}&offset=0`);

  const page = [...data.messages].reverse();

  mergeById(page);
  state.orderedIds = page.map((m) => m.id);
  state.historyOffset = data.count;
  state.hasMore = data.count === pageSize;

  scrollToBottom();
}

async function loadOlder(chatId: string, kind: "personal" | "group") {
  if (!state.hasMore) return;

  const data = kind === "personal"
    ? await api.get(`/conversations/${chatId}/messages?limit=${state.pageSize}&offset=${state.historyOffset}`)
    : await api.get(`/groups/${chatId}/messages?limit=${state.pageSize}&offset=${state.historyOffset}`);

  const page = [...data.messages].reverse();
  const previousHeight = getScrollHeight();

  prependDeduped(page);
  state.historyOffset += data.count;
  state.hasMore = data.count === state.pageSize;

  keepVisualScrollPosition(previousHeight);
}

function onNewMessage(wsEvent: { content: MessageView }) {
  appendIfMissing(wsEvent.content);

  if (isAtBottom()) {
    scrollToBottom();
  } else {
    showNewMessagesBadge();
  }
}
```

---

## Итог

Для текущего backend правильный Telegram-like сценарий такой:

- открывать чат через первую страницу `offset=0`
- получать последние сообщения
- разворачивать их для UI
- догружать старую историю вверх через `offset += count`
- всегда делать `dedupe` по `message.id`
- read-state обновлять через `POST /messages/:message_id/read`
- live-обновления принимать по WebSocket

Это рабочая и корректная схема под текущий API без загрузки всей истории чата целиком.
