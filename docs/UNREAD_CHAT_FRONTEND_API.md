# UNREAD CHAT FRONTEND API

## Назначение

Этот документ описывает полный фронтовый сценарий, когда пользователь открывает **непрочитанный чат** и начинает его читать.

Здесь разобрано:

- как понять, что чат непрочитанный
- как открыть такой чат правильно
- когда и чем сбрасывать `unread_count`
- как вызывать `POST /api/v1/messages/:message_id/read`
- чем отличается личный чат от группы
- какие есть ограничения у текущего backend
- реальные `curl`, ответы и ошибки

---

## Что считается непрочитанным чатом

Фронт понимает, что чат непрочитанный, по `unread_count` из списка чатов.

Основной endpoint:

```http
GET /api/v1/chats/unified?limit=50&offset=0
```

Если у элемента:

- `unread_count > 0`

значит чат нужно показывать как непрочитанный.

Для групп дополнительно есть:

- `mention_count`

---

## Пример списка чатов

### curl

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/chats/unified?limit=20&offset=0" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Пример ответа

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

### Как фронту трактовать

- `type = personal` -> открывать через `/api/v1/conversations/:id/messages`
- `type = support` -> открывать так же, как личку, через `/api/v1/conversations/:id/messages`
- `type = group` -> открывать через `/api/v1/groups/:id/messages`
- `unread_count` -> badge непрочитанных
- `mention_count` -> badge упоминаний в группе

---

## Главный принцип

Когда пользователь открывает непрочитанный чат, фронт должен делать **две разные вещи**:

1. Загрузить последние сообщения
2. Отдельно зафиксировать чтение через `mark as read`

Важно:

- для **личного чата** первый `GET .../messages?offset=0` уже сбрасывает badge `unread_count` на backend
- для **группы** один только `GET .../messages` этого не делает, нужен `POST /messages/:message_id/read`

Но для фронта лучше использовать **единый сценарий**:

1. открыть чат
2. загрузить последнюю страницу
3. отрисовать
4. выбрать anchor message для read
5. вызвать `POST /messages/:message_id/read`
6. локально убрать badge `unread_count`

Так поведение будет одинаковым и для лички, и для группы.

---

## Полный flow для фронта

## Шаг 1. Пользователь нажал на непрочитанный чат

У фронта уже есть:

- `chat.id`
- `chat.type`
- `chat.unread_count`

Если:

- `unread_count === 0`

это обычное открытие чата.

Если:

- `unread_count > 0`

это открытие непрочитанного чата.

---

## Шаг 2. Загрузить последнюю страницу сообщений

### Личный чат / support

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/conversations/4b3b7a8d-1111-4444-9999-16a6047c2f11/messages?limit=50&offset=0" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Группа

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
      "id": "9d38d871-1000-4000-8000-f1f110000003",
      "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
      "sender_id": 11,
      "reply_to_id": null,
      "content": "Ок",
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
      "created_at": "2026-04-01T09:12:00Z",
      "updated_at": "2026-04-01T09:12:00Z",
      "edited_at": null,
      "is_ephemeral": false,
      "ttl_seconds": null,
      "expires_at": null,
      "sender_username": "i.ivanov",
      "sender_full_name": "Иван Иванов",
      "sender_avatar": "https://cdn.example.com/avatar-11.jpg",
      "original_sender_full_name": null,
      "reply_to": null,
      "read_by_count": 1,
      "delivered_count": 1,
      "is_read": true,
      "reactions": []
    },
    {
      "id": "9d38d871-1000-4000-8000-f1f110000002",
      "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
      "sender_id": 52,
      "reply_to_id": null,
      "content": "Посмотри файл",
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
      "read_by_count": 0,
      "delivered_count": 0,
      "is_read": false,
      "reactions": []
    },
    {
      "id": "9d38d871-1000-4000-8000-f1f110000001",
      "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
      "sender_id": 52,
      "reply_to_id": null,
      "content": "Скинул документы",
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
      "created_at": "2026-04-01T09:10:00Z",
      "updated_at": "2026-04-01T09:10:00Z",
      "edited_at": null,
      "is_ephemeral": false,
      "ttl_seconds": null,
      "expires_at": null,
      "sender_username": "a.saparov",
      "sender_full_name": "Айдын Сапаров",
      "sender_avatar": "https://cdn.example.com/avatar-52.jpg",
      "original_sender_full_name": null,
      "reply_to": null,
      "read_by_count": 0,
      "delivered_count": 0,
      "is_read": false,
      "reactions": []
    }
  ],
  "count": 3
}
```

### Что делать фронту после ответа

1. Получить массив `messages`
2. Помнить, что backend вернул его в порядке `newest -> oldest`
3. Развернуть в `oldest -> newest`
4. Отрисовать
5. Прокрутить вниз

---

## Шаг 3. Что фронт должен понимать про unread после открытия

### Личный чат

Если открыт:

```http
GET /api/v1/conversations/:conversation_id/messages?offset=0
```

то backend уже делает reset badge для этого чата.

Это значит:

- если ты после этого заново запросишь список чатов, у лички `unread_count` уже будет `0`

Но:

- read receipt сам по себе этим не завершается
- для единообразного поведения все равно лучше вызвать `POST /messages/:message_id/read`

### Группа

Для группы:

- `GET /api/v1/groups/:group_id/messages?offset=0` не является гарантированным reset unread
- реальное прочтение должно фиксироваться через `POST /messages/:message_id/read`

---

## Шаг 4. Какой `message_id` отправлять в `mark as read`

Это самый важный момент.

### Правильное правило

Фронт должен искать **самое новое видимое входящее сообщение**.

То есть:

- сообщение уже отрисовано
- пользователь реально открыл чат
- сообщение прислал **не текущий пользователь**
- это сообщение самое новое среди видимых входящих

Именно его `id` нужно отправлять в:

```http
POST /api/v1/messages/:message_id/read
```

### Почему именно так

Потому что backend помечает прочитанными:

- все сообщения в этом чате
- до указанного `message_id` включительно
- только те, которые отправлены не текущим пользователем

То есть один вызов может закрыть весь unread block.

### Что нельзя делать

Не надо:

- слать `mark as read` на каждое сообщение
- слать `mark as read` на каждый ререндер
- опираться на `unread_count` как на точную позицию первого unread message

---

## Шаг 5. Вызвать `mark as read`

### curl

```bash
curl --request POST \
  --url "http://localhost:8080/api/v1/messages/9d38d871-1000-4000-8000-f1f110000002/read" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Успешный ответ

```json
{
  "message": "marked as read"
}
```

### Что это реально делает на backend

- вставляет/обновляет `message_status`
- помечает прочитанными все более старые входящие сообщения в этом чате
- для личного чата дополнительно reset'ит badge `unread_count`
- отправляет WebSocket `read_receipt`

---

## Шаг 6. Что фронт должен сделать локально после `mark as read`

После `200 OK` фронт должен сразу:

- поставить локально `chat.unread_count = 0`
- для группы также локально сбросить `mention_count`, если все mentions попали в прочитанный диапазон
- обновить локальное состояние чата
- скрыть badge непрочитанных на chat list

Не нужно ждать новый `GET /chats/unified`, чтобы убрать badge в UI.

Лучше:

- обновить UI сразу локально
- а список чатов позже синхронизировать обычным refetch

---

## Как фронту выбрать read anchor правильно

### Рекомендуемый алгоритм

1. Взять уже отрисованные сообщения
2. Идти с конца списка к началу
3. Найти первое сообщение, где:
   - `sender_id !== currentUserId`
4. Отправить `POST /messages/:message_id/read`

### Пример

После разворота страницы UI видит:

```text
1. Айдын: Скинул документы
2. Айдын: Посмотри файл
3. Я: Ок
```

Нужно выбрать:

- `Посмотри файл`

Почему:

- это самое новое входящее сообщение
- backend прочитает и его, и более старое `Скинул документы`

---

## Edge case: внизу только мои сообщения, а unread badge все еще есть

Такое возможно, если:

- unread сообщения старее и не попали в первую страницу
- либо `unread_count` уже не совпадает идеально с видимой историей

В текущем API нет:

- `first_unread_message_id`
- `first_unread_created_at`
- endpoint "дай сообщения вокруг unread boundary"

Поэтому фронт **не может идеально** показать Telegram-divider "непрочитанные" в точной позиции.

### Что делать в этом случае

Рекомендуемый порядок:

1. Сначала открыть чат с последних сообщений
2. Найти newest visible incoming message
3. Если он есть, вызвать `mark as read` по нему
4. Если его нет, можно:
   - либо не слать `mark as read`, пока пользователь не доскроллит до входящего сообщения
   - либо использовать fallback: взять самое новое видимое сообщение

### Рекомендуемый fallback

Если чат уже открыт, пользователь реально на экране чата, unread badge нужно убрать, а входящих в текущем куске нет:

- можно использовать `id` самого нового видимого сообщения как fallback

Важно:

- это очистит unread старше этой точки
- но WebSocket `read_receipt` в таком кейсе может уйти неидеально
- особенно если выбранное сообщение отправил сам текущий пользователь

Итог:

- **best practice**: брать newest visible incoming message
- **fallback**: newest visible message

---

## Личный чат: полный сценарий от и до

## Шаги

1. На списке чатов получили:
   - `type = personal`
   - `unread_count = 3`
2. Пользователь нажал на чат
3. Фронт делает:
   - `GET /api/v1/conversations/:id/messages?limit=50&offset=0`
4. Рендерит историю снизу
5. Находит newest visible incoming message
6. Делает:
   - `POST /api/v1/messages/:message_id/read`
7. Сразу локально ставит:
   - `unread_count = 0`
8. Если потом refetch'нуть `GET /api/v1/chats/unified`, backend уже тоже отдаст `unread_count = 0`

### Что важно

- личка сама по себе при `offset=0` уже сбрасывает badge на backend
- но `POST /messages/:message_id/read` все равно нужен для корректного read flow

---

## Группа: полный сценарий от и до

## Шаги

1. На списке чатов получили:
   - `type = group`
   - `unread_count = 7`
   - `mention_count = 2`
2. Пользователь нажал на группу
3. Фронт делает:
   - `GET /api/v1/groups/:id/messages?limit=50&offset=0`
4. Рендерит историю снизу
5. Находит newest visible incoming message
6. Делает:
   - `POST /api/v1/messages/:message_id/read`
7. Локально обновляет:
   - `unread_count = 0` или уменьшает до актуального состояния
   - `mention_count = 0` или уменьшает до актуального состояния
8. При следующем refetch списка чатов backend уже пересчитает badge по `message_status`

### Что важно

- для группы read фиксируется именно через `POST /messages/:message_id/read`
- один только `GET /groups/:id/messages` для этого недостаточен

---

## WebSocket при чтении непрочитанного чата

### Что получает sender

После `POST /messages/:message_id/read` backend отправляет:

```json
{
  "type": "read_receipt",
  "from": 11,
  "to": 52,
  "message_id": "9d38d871-1000-4000-8000-f1f110000002",
  "timestamp": 1775034700
}
```

Где:

- `from` это пользователь, который прочитал
- `to` это отправитель anchor message
- `message_id` это сообщение, которое фронт выбрал как read anchor

### Что важно для фронта

- reader не должен ждать этот WebSocket для собственного UI
- reader уже знает, что `mark as read` прошел по HTTP `200`
- поэтому reader обновляет UI сразу локально

### Ограничение backend

Если `mark as read` покрыл несколько чужих сообщений от разных отправителей:

- в live-режиме `read_receipt` уходит только по anchor message
- не всем возможным отправителям

Это ограничение текущей реализации.

---

## Почему нельзя строить точный unread divider по текущему API

Сейчас backend не отдает:

- `first_unread_message_id`
- `unread_message_ids`
- `read_up_to_message_id` для текущего пользователя
- сообщения `around message_id`

Из-за этого фронт не может на 100% точно сделать Telegram-полоску:

- `Непрочитанные сообщения`

в правильной позиции во всех кейсах.

### Дополнительно важно

Поле `MessageView.is_read` в истории:

- не надо использовать как единственный источник истины для unread boundary
- особенно в группах

Почему:

- в истории `is_read` считается не как "прочитал именно текущий пользователь", а как упрощенное поле удобства
- для группы оно не подходит как точный unread marker текущего юзера

Правильный источник для badge:

- `unread_count` из списка чатов

Правильный источник для фиксации чтения:

- `POST /messages/:message_id/read`

---

## Ошибки

### Не участник личного чата

```json
{
  "error": {
    "code": "NOT_PARTICIPANT",
    "message": "You are not a participant of this chat",
    "details": null
  }
}
```

### Не участник группы

```json
{
  "error": {
    "code": "NOT_GROUP_MEMBER",
    "message": "You are not a member of this group",
    "details": null
  }
}
```

### Невалидный ID

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "invalid conversation ID",
    "details": null
  }
}
```

или:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "invalid group ID",
    "details": null
  }
}
```

### Сообщение не найдено при read

```json
{
  "error": {
    "code": "MESSAGE_NOT_FOUND",
    "message": "Message not found",
    "details": null
  }
}
```

### Невалидные query params

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid query parameters",
    "details": null
  }
}
```

---

## Рекомендуемая логика на фронте

```ts
function openUnreadChat(chat: UnifiedChat, currentUserId: number) {
  const kind = chat.type === "group" ? "group" : "personal";
  loadLastPage(chat.id, kind).then((data) => {
    const messages = [...data.messages].reverse(); // oldest -> newest
    render(messages);
    scrollToBottom();

    const anchor = findNewestVisibleIncoming(messages, currentUserId)
      ?? findNewestVisibleMessage(messages);

    if (anchor) {
      markAsRead(anchor.id).then(() => {
        updateChatBadgeLocally(chat.id, { unreadCount: 0, mentionCount: 0 });
      });
    }
  });
}

function findNewestVisibleIncoming(messages: MessageView[], currentUserId: number) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id !== currentUserId) return messages[i];
  }
  return null;
}

function findNewestVisibleMessage(messages: MessageView[]) {
  return messages.length ? messages[messages.length - 1] : null;
}
```

---

## Что фронту делать не надо

- не надо ждать полного refetch списка чатов, чтобы убрать badge
- не надо слать `mark as read` по каждому сообщению
- не надо пытаться вычислять точный unread divider только по `unread_count`
- не надо трактовать `is_read` из истории как точный per-user unread marker в группе

---

## Итог

Правильный сценарий чтения непрочитанного чата в текущем API такой:

1. взять `unread_count` из `GET /api/v1/chats/unified`
2. открыть чат с `GET .../messages?limit=50&offset=0`
3. отрисовать последние сообщения
4. найти самое новое видимое входящее сообщение
5. вызвать `POST /api/v1/messages/:message_id/read`
6. сразу локально сбросить badge
7. дальше жить в realtime через WebSocket

Для лички это работает с учетом того, что `offset=0` уже сбрасывает badge.

Для группы это обязательно, потому что read-state фиксируется именно через `POST /messages/:message_id/read`.
