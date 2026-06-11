# Chat API для Frontend

Документ описывает текущую реализацию chat/websocket API в этом бэкенде.

Важно:
- Все пути ниже указаны относительно `BASE_URL`, например `http://localhost:8080/api/v1`.
- Почти все chat endpoints требуют `Authorization: Bearer <access_token>`.
- Формат ошибок у chat endpoints унифицирован:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "invalid request body",
    "details": null
  }
}
```

- Примеры ответов ниже показаны как реальные по структуре, но значения `id`, даты, URL и счетчики приведены как пример.
- История сообщений отдается в порядке `created_at DESC`, то есть сначала новые сообщения.

---

## 1. Быстрый сценарий интеграции

1. Получить `access_token` через auth.
2. Открыть websocket `GET /api/v1/ws`.
3. Получить список чатов через `GET /chats/unified`.
4. Для личного чата:
   - создать/получить диалог через `POST /conversations`
   - загрузить историю через `GET /conversations/{conversation_id}/messages`
   - отправлять сообщения через `POST /conversations/{conversation_id}/messages`
5. Для группы:
   - взять список групп через `GET /groups`
   - загрузить историю через `GET /groups/{group_id}/messages`
   - отправлять сообщения через `POST /groups/{group_id}/messages`
6. После открытия чата отметить прочтение через `POST /messages/{message_id}/read`.
7. Для файлов:
   - сначала загрузить файл через `POST /files/upload`
   - потом отправить chat message с `type=file|image|video|audio|voice|video_message`
   - на текущем бэкенде attachment-поля в публичном send endpoint не передаются отдельно, поэтому фронту нужно согласовать фактический формат хранения ссылки в `content` или в `metadata` для групповых сообщений.

---

## 2. Авторизация

### HTTP

```bash
curl -X GET "$BASE_URL/chats/unified" \
  -H "Authorization: Bearer $TOKEN"
```

### WebSocket

Поддерживаются варианты:
- `Authorization: Bearer <token>` в upgrade request
- `?token=<token>`
- при Keycloak middleware также поддерживается `?access_token=<token>`

Пример:

```text
ws://localhost:8080/api/v1/ws?token=<access_token>
```

---

## 3. WebSocket

### 3.1 Подключение

Endpoint:

```text
GET /api/v1/ws
```

После успешного подключения сервер:
- регистрирует сессию пользователя
- отправляет событие `initial_online_list`
- начинает слать realtime события по чатам и статусам

### 3.2 Что клиент может отправлять в websocket

Поддерживаются только эти `type`:
- `typing`
- `read`
- `ping`

#### `typing`

```json
{
  "type": "typing",
  "to": 45,
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "content": {
    "is_typing": true
  }
}
```

Что делает сервер:
- проставляет `from` текущим user id
- проставляет `timestamp`
- пересылает сообщение адресату

#### `read`

```json
{
  "type": "read",
  "to": 45,
  "message_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500"
}
```

Что делает сервер:
- просто пробрасывает событие через hub
- для реального mark-as-read фронт все равно должен вызывать REST `POST /messages/{message_id}/read`

#### `ping`

```json
{
  "type": "ping"
}
```

Ответ:

```json
{
  "type": "pong",
  "from": 0,
  "to": 123,
  "timestamp": 1743177600
}
```

### 3.3 Что сервер присылает в websocket

Общий envelope:

```json
{
  "type": "new_message",
  "from": 45,
  "to": 123,
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "message_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
  "content": {},
  "is_mention": false,
  "timestamp": 1743177600
}
```

#### `initial_online_list`

Сразу после подключения.

```json
{
  "type": "initial_online_list",
  "to": 123,
  "content": [45, 78, 99],
  "timestamp": 1743177600
}
```

`content` это массив `user_id`, которые сейчас онлайн и относятся к "интересующим" пользователям для текущего юзера.

#### `user_status`

Пользователь стал online/offline.

```json
{
  "type": "user_status",
  "from": 45,
  "content": {
    "user_id": 45,
    "status": "online"
  },
  "timestamp": 1743177600
}
```

При offline может прийти расширенный payload:

```json
{
  "type": "user_status",
  "from": 45,
  "content": {
    "user_id": 45,
    "status": "offline",
    "last_seen_at": "2026-03-28T10:15:30Z",
    "is_last_seen": true
  },
  "timestamp": 1743177600
}
```

#### `new_message`

Новое сообщение в личном чате или группе.

```json
{
  "type": "new_message",
  "to": 123,
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "message_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
  "is_mention": false,
  "content": {
    "id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
    "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
    "sender_id": 45,
    "content": "Привет",
    "content_hash": "",
    "encrypted_keys": {},
    "type": "text",
    "metadata": null,
    "is_edited": false,
    "is_forwarded": false,
    "is_deleted": false,
    "is_ephemeral": false,
    "created_at": "2026-03-28T10:15:30Z",
    "updated_at": "2026-03-28T10:15:30Z",
    "sender_username": "user45",
    "sender_full_name": "Ivan Ivanov",
    "sender_avatar": "http://localhost:8080/api/v1/files/download?object_name=image/45/avatar.jpg",
    "read_by_count": 0,
    "delivered_count": 0,
    "is_read": false,
    "reactions": []
  },
  "timestamp": 1743177600
}
```

#### `typing`

```json
{
  "type": "typing",
  "from": 45,
  "to": 123,
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "content": {
    "is_typing": true
  },
  "timestamp": 1743177600
}
```

#### `read_receipt`

Сервер шлет отправителю, когда другой пользователь вызвал REST mark-as-read.

```json
{
  "type": "read_receipt",
  "from": 123,
  "to": 45,
  "message_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
  "timestamp": 1743177600
}
```

#### `message_edited`

`content` содержит полный обновленный `MessageView`.

```json
{
  "type": "message_edited",
  "to": 123,
  "content": {
    "id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
    "content": "Исправленный текст",
    "is_edited": true,
    "edited_at": "2026-03-28T10:20:00Z"
  },
  "timestamp": 1743177900
}
```

#### `message_deleted`

Используется для delete-for-me и для автоудаления ephemeral сообщений.

```json
{
  "type": "message_deleted",
  "to": 123,
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "message_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
  "content": {
    "is_for_everyone": false,
    "new_last_message": null
  },
  "timestamp": 1743178000
}
```

#### `chat_hidden`

Сервер шлет только текущему пользователю, когда он скрыл чат/группу.

```json
{
  "type": "chat_hidden",
  "to": 123,
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "content": {
    "chat_type": "personal"
  },
  "timestamp": 1743178000
}
```

Для групп:

```json
{
  "type": "chat_hidden",
  "to": 123,
  "conversation_id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
  "content": {
    "chat_type": "group"
  },
  "timestamp": 1743178000
}
```

#### `message_reactions_updated`

```json
{
  "type": "message_reactions_updated",
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "message_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
  "content": {
    "message_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
    "reactions": [
      {
        "reaction": "🔥",
        "count": 2,
        "users": [
          { "id": 45, "full_name": "Ivan Ivanov", "avatar": null },
          { "id": 123, "full_name": "Petr Petrov", "avatar": null }
        ],
        "reacted": true
      }
    ]
  },
  "timestamp": 1743178100
}
```

### 3.4 Важные замечания по websocket

- `chat_deleted` существует в коде websocket hub, но в текущей реализации chat/group сервисы его не шлют. На фронте на него можно не рассчитывать.
- `read` websocket event сам по себе не обновляет состояние в БД. Для этого нужен REST.
- Сервер сам отправляет websocket ping frames. Клиент должен корректно отвечать pong frame на уровне websocket библиотеки.

---

## 4. Основные модели

### 4.1 Conversation

```json
{
  "id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "type": "personal",
  "created_by": 123,
  "created_at": "2026-03-28T10:00:00Z",
  "updated_at": "2026-03-28T10:00:00Z"
}
```

### 4.2 ConversationView

```json
{
  "id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "type": "personal",
  "peer_id": 45,
  "peer_username": "user45",
  "peer_full_name": "Ivan Ivanov",
  "peer_avatar": null,
  "last_seen_at": "2026-03-28T09:58:10Z",
  "group_id": null,
  "group_name": null,
  "group_avatar": null,
  "ai_model": null,
  "ai_title": null,
  "last_message": null,
  "unread_count": 0,
  "mention_count": 0,
  "is_pinned": false,
  "is_muted": false,
  "created_at": "2026-03-28T10:00:00Z",
  "updated_at": "2026-03-28T10:00:00Z"
}
```

### 4.3 MessageView

```json
{
  "id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "sender_id": 45,
  "reply_to_id": null,
  "content": "Привет",
  "content_hash": "",
  "encrypted_keys": {},
  "type": "text",
  "attachment_url": null,
  "attachment_type": null,
  "attachment_size": null,
  "metadata": null,
  "is_edited": false,
  "is_forwarded": false,
  "original_sender_id": null,
  "is_deleted": false,
  "created_at": "2026-03-28T10:15:30Z",
  "updated_at": "2026-03-28T10:15:30Z",
  "edited_at": null,
  "is_ephemeral": false,
  "ttl_seconds": null,
  "expires_at": null,
  "sender_username": "user45",
  "sender_full_name": "Ivan Ivanov",
  "sender_avatar": null,
  "original_sender_full_name": null,
  "reply_to": null,
  "read_by_count": 0,
  "delivered_count": 0,
  "is_read": false,
  "reactions": []
}
```

### 4.4 GroupView

```json
{
  "id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
  "name": "Backend Team",
  "description": "Основная рабочая группа",
  "avatar_url": null,
  "type": "private",
  "max_members": 200,
  "created_by": 123,
  "is_active": true,
  "created_at": "2026-03-28T10:00:00Z",
  "updated_at": "2026-03-28T10:00:00Z",
  "member_role": "owner",
  "member_count": 7,
  "unread_count": 3,
  "mention_count": 1,
  "last_message": null
}
```

---

## 5. Личные чаты

## 5.1 Создать или получить личный диалог

```bash
curl -X POST "$BASE_URL/conversations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "peer_id": 45
  }'
```

Ответ `200 OK`:

```json
{
  "id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "type": "personal",
  "created_by": 123,
  "created_at": "2026-03-28T10:00:00Z",
  "updated_at": "2026-03-28T10:00:00Z"
}
```

Ошибки:
- `400 BAD_REQUEST` если `peer_id` равен самому себе

## 5.2 Получить список личных диалогов

```bash
curl -X GET "$BASE_URL/conversations?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ `200 OK`:

```json
{
  "conversations": [
    {
      "id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
      "type": "personal",
      "peer_id": 45,
      "peer_username": "user45",
      "peer_full_name": "Ivan Ivanov",
      "peer_avatar": null,
      "last_seen_at": "2026-03-28T09:58:10Z",
      "last_message": null,
      "unread_count": 0,
      "mention_count": 0,
      "is_pinned": false,
      "is_muted": false,
      "created_at": "2026-03-28T10:00:00Z",
      "updated_at": "2026-03-28T10:00:00Z"
    }
  ],
  "count": 1
}
```

## 5.3 Получить сообщения личного диалога

```bash
curl -X GET "$BASE_URL/conversations/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5/messages?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ `200 OK`:

```json
{
  "messages": [
    {
      "id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
      "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
      "sender_id": 45,
      "content": "Привет",
      "content_hash": "",
      "encrypted_keys": {},
      "type": "text",
      "metadata": null,
      "is_edited": false,
      "is_forwarded": false,
      "is_deleted": false,
      "created_at": "2026-03-28T10:15:30Z",
      "updated_at": "2026-03-28T10:15:30Z",
      "is_ephemeral": false,
      "sender_username": "user45",
      "sender_full_name": "Ivan Ivanov",
      "sender_avatar": null,
      "reply_to": null,
      "read_by_count": 0,
      "delivered_count": 0,
      "is_read": false,
      "reactions": []
    }
  ],
  "count": 1
}
```

Важно:
- при `offset=0` backend сбрасывает `unread_count` чата
- сами `message_status.read_at` при этом не проставляются, для этого нужен `POST /messages/{message_id}/read`

## 5.4 Отправить сообщение в личный диалог

Поддерживаемые `type`:
- `text`
- `image`
- `video`
- `file`
- `audio`
- `voice`
- `video_message`

### Обычное текстовое сообщение

```bash
curl -X POST "$BASE_URL/conversations/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Привет",
    "type": "text"
  }'
```

### Ответ на сообщение

```bash
curl -X POST "$BASE_URL/conversations/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Отвечаю",
    "type": "text",
    "reply_to_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500"
  }'
```

### Исчезающее сообщение

```bash
curl -X POST "$BASE_URL/conversations/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Это исчезнет",
    "type": "text",
    "is_ephemeral": true,
    "ttl_seconds": 60
  }'
```

Ответ `201 Created`:

```json
{
  "id": "c51ec2a7-4d5d-4f67-9a2c-17c8559a2f83",
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "sender_id": 123,
  "reply_to_id": null,
  "content": "Это исчезнет",
  "content_hash": "",
  "encrypted_keys": {},
  "type": "text",
  "metadata": null,
  "is_edited": false,
  "is_forwarded": false,
  "is_deleted": false,
  "created_at": "2026-03-28T10:16:00Z",
  "updated_at": "2026-03-28T10:16:00Z",
  "is_ephemeral": true,
  "ttl_seconds": 60,
  "expires_at": null,
  "sender_username": "me",
  "sender_full_name": "Petr Petrov",
  "sender_avatar": null,
  "reply_to": null,
  "read_by_count": 0,
  "delivered_count": 0,
  "is_read": false,
  "reactions": []
}
```

Важно:
- таймер удаления запускается, когда другой пользователь прочитал сообщение
- после истечения срока сервер удалит сообщение и пришлет `message_deleted`

## 5.5 Скрыть личный чат

```bash
curl -X DELETE "$BASE_URL/conversations/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "conversation hidden successfully",
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5"
}
```

Побочный эффект:
- websocket `chat_hidden`
- если чат был pinned, backend его распинит

## 5.6 Восстановить скрытый личный чат

```bash
curl -X POST "$BASE_URL/conversations/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5/unhide" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "conversation restored successfully",
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5"
}
```

---

## 6. Группы

## 6.1 Создать группу

```bash
curl -X POST "$BASE_URL/groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backend Team",
    "description": "Основная рабочая группа",
    "type": "private",
    "max_members": 200
  }'
```

Ответ `201 Created`:

```json
{
  "id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
  "name": "Backend Team",
  "description": "Основная рабочая группа",
  "avatar_url": null,
  "type": "private",
  "max_members": 200,
  "created_by": 123,
  "is_active": true,
  "created_at": "2026-03-28T10:00:00Z",
  "updated_at": "2026-03-28T10:00:00Z"
}
```

## 6.2 Получить список групп пользователя

```bash
curl -X GET "$BASE_URL/groups?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "groups": [
    {
      "id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
      "name": "Backend Team",
      "description": "Основная рабочая группа",
      "avatar_url": null,
      "type": "private",
      "max_members": 200,
      "created_by": 123,
      "is_active": true,
      "created_at": "2026-03-28T10:00:00Z",
      "updated_at": "2026-03-28T10:00:00Z",
      "member_role": "owner",
      "member_count": 7,
      "unread_count": 3,
      "mention_count": 1,
      "last_message": null
    }
  ],
  "count": 1
}
```

## 6.3 Получить детали группы

```bash
curl -X GET "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
  "name": "Backend Team",
  "description": "Основная рабочая группа",
  "avatar_url": null,
  "type": "private",
  "max_members": 200,
  "created_by": 123,
  "is_active": true,
  "created_at": "2026-03-28T10:00:00Z",
  "updated_at": "2026-03-28T10:00:00Z",
  "members": [
    {
      "id": 123,
      "email": "user@example.com",
      "username": "me",
      "first_name": "Petr",
      "last_name": "Petrov",
      "full_name": "Petr Petrov",
      "availability_status": "online",
      "role": "owner"
    }
  ],
  "member_count": 1
}
```

## 6.4 Обновить группу

```bash
curl -X PUT "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backend Core",
    "description": "Новая версия описания"
  }'
```

Ответ:

```json
{
  "message": "group updated successfully"
}
```

## 6.5 Загрузить аватар группы

```bash
curl -X PUT "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/avatar" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@group.png"
```

Ответ:

```json
{
  "id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
  "name": "Backend Core",
  "avatar_url": "http://localhost:8080/api/v1/files/download?object_name=group_avatar/123/group.png"
}
```

## 6.6 Добавить участников

Поддерживаются два формата:
- один пользователь через `user_id`
- несколько пользователей через `user_ids`

```bash
curl -X POST "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": [45, 78]
  }'
```

Ответ:

```json
{
  "message": "members added successfully"
}
```

## 6.7 Удалить участника

```bash
curl -X DELETE "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/members/45" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "member removed successfully"
}
```

## 6.8 Выйти из группы

```bash
curl -X POST "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/leave" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "left group successfully"
}
```

## 6.9 Обновить роль участника

Разрешенные роли:
- `member`
- `admin`

```bash
curl -X PUT "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/members/45/role" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

Ответ:

```json
{
  "message": "role updated successfully"
}
```

## 6.10 Получить историю группы

```bash
curl -X GET "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/messages?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ такой же по структуре, как у личного чата:

```json
{
  "messages": [],
  "count": 0
}
```

## 6.11 Отправить сообщение в группу

```bash
curl -X POST "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Привет, команда",
    "type": "text"
  }'
```

Ответ `201 Created`:

```json
{
  "id": "0c46a2a0-2c9c-4ed8-b7ef-6b3cda2f4c9b",
  "conversation_id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
  "sender_id": 123,
  "content": "Привет, команда",
  "type": "text",
  "metadata": null,
  "sender_username": "me",
  "sender_full_name": "Petr Petrov",
  "reactions": []
}
```

### Отправить сообщение с mentions

Для групп mentions передаются в `metadata` строкой JSON.

```bash
curl -X POST "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Нужен ответ от @user45",
    "type": "text",
    "metadata": "{\"mentions\":[\"user45\"]}"
  }'
```

Особенности:
- backend резолвит usernames в user ids
- сохраняет mentions
- для упомянутых пользователей websocket `new_message` придет с `is_mention=true`
- скрытая группа у упомянутого пользователя автоматически восстанавливается

## 6.12 Скрыть группу

```bash
curl -X DELETE "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/hide" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "group hidden successfully",
  "group_id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72"
}
```

## 6.13 Восстановить группу

```bash
curl -X POST "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72/unhide" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "group restored successfully",
  "group_id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72"
}
```

## 6.14 Удалить группу

```bash
curl -X DELETE "$BASE_URL/groups/f7f6601a-d7a4-4c53-a2d7-1f3662faad72" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "group deleted successfully"
}
```

---

## 7. Общие операции над сообщениями

## 7.1 Редактировать сообщение

Работает и для личных сообщений, и для групповых.

```bash
curl -X PUT "$BASE_URL/messages/e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Исправленный текст"
  }'
```

Ответ:

```json
{
  "message": "message updated successfully"
}
```

Побочный эффект:
- всем онлайн-участникам приходит websocket `message_edited`

## 7.2 Удалить одно сообщение только у себя

```bash
curl -X DELETE "$BASE_URL/messages/e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "message deleted successfully"
}
```

Важно:
- это `delete for me`
- backend не делает global delete для всех
- на websocket текущему пользователю прилетает `message_deleted`

## 7.3 Удалить несколько сообщений только у себя

```bash
curl -X DELETE "$BASE_URL/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message_ids": [
      "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
      "c51ec2a7-4d5d-4f67-9a2c-17c8559a2f83"
    ]
  }'
```

Ответ:

```json
{
  "message": "messages deleted successfully"
}
```

## 7.4 Отметить сообщение как прочитанное

```bash
curl -X POST "$BASE_URL/messages/e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500/read" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "marked as read"
}
```

Побочные эффекты:
- sender получает websocket `read_receipt`
- unread_count для чата сбрасывается
- для ephemeral messages может стартовать countdown удаления

## 7.5 Получить список прочитавших сообщение

Только отправитель сообщения имеет доступ.

```bash
curl -X GET "$BASE_URL/messages/e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500/viewers" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
[
  {
    "user_id": 45,
    "full_name": "Ivan Ivanov",
    "avatar_url": null,
    "read_at": "2026-03-28T10:22:10Z"
  }
]
```

## 7.6 Переслать сообщения

`target_chat_ids` может содержать и personal conversation ids, и group ids.

```bash
curl -X POST "$BASE_URL/messages/forward" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message_ids": [
      "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500"
    ],
    "target_chat_ids": [
      "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
      "f7f6601a-d7a4-4c53-a2d7-1f3662faad72"
    ]
  }'
```

Ответ:

```json
[
  {
    "id": "e3df8011-c3db-4482-9191-31d4b90bda7c",
    "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
    "sender_id": 123,
    "content": "Привет",
    "type": "text",
    "is_forwarded": true,
    "original_sender_id": 45,
    "original_sender_full_name": "Ivan Ivanov"
  }
]
```

## 7.7 Добавить реакцию

```bash
curl -X POST "$BASE_URL/messages/e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500/reactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reaction": "🔥"
  }'
```

Ответ:

```json
{
  "message": "reaction added",
  "reactions": [
    {
      "reaction": "🔥",
      "count": 1,
      "users": [
        {
          "id": 123,
          "full_name": "Petr Petrov",
          "avatar": null
        }
      ],
      "reacted": true
    }
  ]
}
```

Побочный эффект:
- всем онлайн-участникам прилетает `message_reactions_updated`

## 7.8 Удалить реакцию

Emoji должен быть URL-encoded.

```bash
curl -X DELETE "$BASE_URL/messages/e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500/reactions/%F0%9F%94%A5" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "reaction removed",
  "reactions": []
}
```

---

## 8. Broadcast и share

## 8.1 Массовая отправка в личные диалоги

Сервис создаст отдельный personal conversation для каждого пользователя, если его еще нет.

```bash
curl -X POST "$BASE_URL/conversations/broadcast" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_user_ids": [45, 78],
    "content": "Общее сообщение",
    "message_type": "text"
  }'
```

Ответ:

```json
{
  "success_count": 2,
  "failure_count": 0,
  "results": [
    {
      "user_id": 45,
      "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
      "message_id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
      "success": true
    },
    {
      "user_id": 78,
      "conversation_id": "c5f847b7-9e8d-4b0d-8be6-3c0c9e2ce501",
      "message_id": "a2f847b7-9e8d-4b0d-8be6-3c0c9e2ce502",
      "success": true
    }
  ]
}
```

## 8.2 Поделиться задачей или событием в чат

`item_type`:
- `task`
- `event`

```bash
curl -X POST "$BASE_URL/chats/share" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_chat_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
    "item_type": "task",
    "item_id": "a82b90c8-4e59-4c46-baf5-a28f12785e59",
    "comment": "Посмотри эту задачу"
  }'
```

Ответ `201 Created`:

```json
{
  "id": "f3df8011-c3db-4482-9191-31d4b90bda7c",
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "sender_id": 123,
  "content": "Посмотри эту задачу",
  "type": "share_task",
  "metadata": "{\"kind\":\"task\",\"task_id\":\"a82b90c8-4e59-4c46-baf5-a28f12785e59\",\"title\":\"Task title\",\"board_id\":\"b82b90c8-4e59-4c46-baf5-a28f12785e60\"}"
}
```

---

## 9. Список чатов, пины, папки

## 9.1 Unified chat list

Это основной endpoint, если фронту нужен единый список personal + groups.

```bash
curl -X GET "$BASE_URL/chats/unified?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ `200 OK`:

```json
[
  {
    "id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
    "type": "personal",
    "peer_id": 45,
    "peer_username": "user45",
    "peer_full_name": "Ivan Ivanov",
    "peer_avatar": null,
    "last_seen_at": "2026-03-28T09:58:10Z",
    "last_message": null,
    "unread_count": 0,
    "mention_count": 0,
    "is_pinned": true,
    "is_muted": false,
    "created_at": "2026-03-28T10:00:00Z",
    "updated_at": "2026-03-28T10:00:00Z"
  },
  {
    "id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
    "type": "group",
    "group_id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
    "group_name": "Backend Team",
    "group_avatar": null,
    "last_message": null,
    "unread_count": 3,
    "mention_count": 1,
    "is_pinned": false,
    "is_muted": false,
    "created_at": "2026-03-28T10:00:00Z",
    "updated_at": "2026-03-28T10:00:00Z"
  }
]
```

## 9.2 Закрепить чат

`chat_type`:
- `personal`
- `group`

```bash
curl -X POST "$BASE_URL/chats/pin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
    "chat_type": "personal"
  }'
```

Ответ:

```json
{
  "message": "chat pinned successfully"
}
```

## 9.3 Открепить чат

```bash
curl -X POST "$BASE_URL/chats/unpin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
    "chat_type": "personal"
  }'
```

Ответ:

```json
{
  "message": "chat unpinned successfully"
}
```

## 9.4 Получить pinned chats

```bash
curl -X GET "$BASE_URL/chats/pinned" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "pinned_chats": [
    {
      "id": "17be12d8-c9c3-476a-b9d8-2997f0e7ef40",
      "user_id": 123,
      "chat_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
      "chat_type": "personal",
      "position": 1,
      "created_at": "2026-03-28T10:30:00Z",
      "updated_at": "2026-03-28T10:30:00Z"
    }
  ]
}
```

## 9.5 Закрепить сообщение

```bash
curl -X POST "$BASE_URL/messages/pin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
    "chat_type": "group",
    "message_id": "0c46a2a0-2c9c-4ed8-b7ef-6b3cda2f4c9b"
  }'
```

Ответ:

```json
{
  "message": "message pinned successfully"
}
```

## 9.6 Открепить сообщение

```bash
curl -X POST "$BASE_URL/messages/0c46a2a0-2c9c-4ed8-b7ef-6b3cda2f4c9b/unpin?chat_id=f7f6601a-d7a4-4c53-a2d7-1f3662faad72&chat_type=group" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "message unpinned successfully"
}
```

## 9.7 Получить pinned messages

```bash
curl -X GET "$BASE_URL/messages/pinned?chat_id=f7f6601a-d7a4-4c53-a2d7-1f3662faad72&chat_type=group" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "pinned_messages": [
    {
      "id": "8803f8a3-b76d-4d12-9d49-38306316dfd8",
      "chat_id": "f7f6601a-d7a4-4c53-a2d7-1f3662faad72",
      "chat_type": "group",
      "message_id": "0c46a2a0-2c9c-4ed8-b7ef-6b3cda2f4c9b",
      "pinned_by": 123,
      "position": 1,
      "created_at": "2026-03-28T10:35:00Z"
    }
  ]
}
```

## 9.8 Папки чатов

### Создать папку

```bash
curl -X POST "$BASE_URL/folders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Работа"}'
```

Ответ:

```json
{
  "id": "ab97dfe0-c6cc-43d5-a67b-a0dbe4f55ccb",
  "name": "Работа",
  "user_id": 123,
  "created_at": "2026-03-28T10:40:00Z",
  "updated_at": "2026-03-28T10:40:00Z"
}
```

### Получить все папки

```bash
curl -X GET "$BASE_URL/folders" \
  -H "Authorization: Bearer $TOKEN"
```

### Получить одну папку

```bash
curl -X GET "$BASE_URL/folders/ab97dfe0-c6cc-43d5-a67b-a0dbe4f55ccb" \
  -H "Authorization: Bearer $TOKEN"
```

### Обновить папку

```bash
curl -X PUT "$BASE_URL/folders/ab97dfe0-c6cc-43d5-a67b-a0dbe4f55ccb" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Рабочие чаты"}'
```

Ответ:

```json
{
  "message": "folder updated"
}
```

### Удалить папку

```bash
curl -X DELETE "$BASE_URL/folders/ab97dfe0-c6cc-43d5-a67b-a0dbe4f55ccb" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "folder deleted"
}
```

### Добавить чат в папку

Здесь `chat_type`:
- `conversation`
- `group`

```bash
curl -X POST "$BASE_URL/folders/ab97dfe0-c6cc-43d5-a67b-a0dbe4f55ccb/chats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
    "chat_type": "conversation"
  }'
```

Ответ:

```json
{
  "message": "chat added to folder"
}
```

### Удалить чат из папки

```bash
curl -X DELETE "$BASE_URL/folders/ab97dfe0-c6cc-43d5-a67b-a0dbe4f55ccb/chats/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "chat removed from folder"
}
```

---

## 10. Файлы для чата

## 10.1 Загрузить файл

```bash
curl -X POST "$BASE_URL/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@photo.jpg" \
  -F "type=image"
```

Ответ:

```json
{
  "object_name": "image/123/1743178000_photo.jpg",
  "url": "http://localhost:8080/api/v1/files/download?object_name=image/123/1743178000_photo.jpg",
  "filename": "photo.jpg",
  "size": 245678,
  "type": "image"
}
```

## 10.2 Получить download URL по object_name

```bash
curl -X GET "$BASE_URL/files/url?object_name=image/123/1743178000_photo.jpg" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "url": "http://localhost:8080/api/v1/files/download?object_name=image/123/1743178000_photo.jpg",
  "expires_in": "1h"
}
```

## 10.3 Скачать файл

```bash
curl -X GET "http://localhost:8080/api/v1/files/download?object_name=image/123/1743178000_photo.jpg" \
  -o photo.jpg
```

## 10.4 Удалить файл

```bash
curl -X DELETE "$BASE_URL/files?object_name=image/123/1743178000_photo.jpg" \
  -H "Authorization: Bearer $TOKEN"
```

Ответ:

```json
{
  "message": "file deleted successfully"
}
```

### Важное замечание по файлам в chat message

Сейчас backend:
- возвращает в `MessageView` поля `attachment_url`, `attachment_type`, `attachment_size`
- но публичные chat endpoints `POST /conversations/{id}/messages` и `POST /groups/{id}/messages` не принимают отдельные attachment поля в body

То есть для фронта нужно считать актуальным один из вариантов:
- хранить ссылку на файл в `content`
- для групп хранить дополнительные данные в `metadata`
- либо доработать backend, если нужен явный `attachment_url` в request body

Это важное ограничение текущей реализации.

---

## 11. Частые коды ошибок

### 400

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "invalid conversation ID",
    "details": null
  }
}
```

или

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid request body",
    "details": null
  }
}
```

### 401

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authentication token",
    "details": null
  }
}
```

или

```json
{
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Invalid token",
    "details": null
  }
}
```

### 403

Для personal chat:

```json
{
  "error": {
    "code": "NOT_PARTICIPANT",
    "message": "You are not a participant of this chat",
    "details": null
  }
}
```

Для group:

```json
{
  "error": {
    "code": "NOT_GROUP_MEMBER",
    "message": "You are not a member of this group",
    "details": null
  }
}
```

### 404

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

## 12. Что фронту важно учесть

- История сообщений идет в обратном порядке: новые сверху в response, если нужен обычный чат UI, фронт обычно разворачивает массив.
- `GET /conversations/{id}/messages?offset=0` сбрасывает unread badge, но не заменяет `mark as read`.
- Для личных чатов `metadata` через публичный send endpoint сейчас не передается.
- Для групп `metadata` можно использовать, например, для mentions.
- Global delete for everyone в текущем API нет. Удаление сообщения через `/messages/{id}` это delete-for-me.
- Реакции обновляются и через REST response, и через websocket `message_reactions_updated`.
- При скрытии чата/группы backend автоматически снимает pin.
- При новом сообщении скрытый чат/группа восстанавливается у участников.

---

## 13. Рекомендуемая последовательность для фронта

### При запуске мессенджера

1. Открыть websocket.
2. Вызвать `GET /chats/unified`.
3. Отрисовать список чатов.
4. Применить realtime обновления из websocket.

### При открытии личного чата

1. `GET /conversations/{conversation_id}/messages?limit=50&offset=0`
2. показать историю
3. на последнее входящее сообщение вызвать `POST /messages/{message_id}/read`

### При открытии группы

1. `GET /groups/{group_id}/messages?limit=50&offset=0`
2. показать историю
3. при необходимости на последнее входящее сообщение вызвать `POST /messages/{message_id}/read`

### При отправке файла

1. `POST /files/upload`
2. взять `url` или `object_name`
3. отправить chat message
4. локально показать оптимистичное сообщение и затем заменить ответом сервера

