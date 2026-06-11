# E2EE Frontend Integration Guide

Актуально по состоянию на `2026-04-05`.

Этот документ предназначен для frontend-разработчиков.
Его цель: дать один практический источник правды, чтобы без догадок подключить E2EE login, backup restore, web onboarding и чтение старой истории.

Если старые E2EE документы где-то расходятся, для frontend интеграции ориентируйтесь на этот файл и на фактические API response.

## 1. Коротко: что важно понять сразу

У web-клиента есть 2 режима обычного login:

1. `ordinary login + fresh web key`
2. `ordinary login + restored identity key from backup`

Разница критична:

- `fresh web key` дает доступ к новым сообщениям, но старая E2EE история обычно не откроется без `QR + history sync`
- `restored identity key from backup` может дать доступ и к старой E2EE истории уже после обычного login, без mobile app, если backup совместим с текущим restore contract

Причина в том, что backend теперь поддерживает восстановление старой истории по совпадающему `public_key`, даже если у текущего браузера новый `device_id`.

## 2. Decision Tree для frontend

Используйте такую логику:

1. Пользователь вошел через `POST /api/v1/auth/login`
2. Frontend понимает, нужен ли доступ к старой E2EE истории сразу
3. Если нужен, сначала пробуем `GET /api/v1/e2ee/backup`
4. Если backup есть и пользователь знает master password:
   - расшифровываем backup локально
   - извлекаем старый private identity key
   - вычисляем `public_key`
   - регистрируем браузер через `POST /api/v1/e2ee/device/register` именно с восстановленным `public_key`
   - если decrypt не прошел, не отправляем guessed `public_key`, а переключаемся на `fresh-key flow` или `QR linked-device flow`
5. Если backup нет или пароль неизвестен:
   - регистрируем fresh web key
   - старую историю потом открываем через QR pairing или не открываем вовсе

Рекомендуемый UX:

- если у пользователя нет доступа к mobile app и ему нужна старая история, используйте именно `restore-first flow`
- если нужен быстрый старт без старой истории, используйте `fresh-key flow`

## 3. Канонические контракты

### 3.1 Device public key

Backend ожидает:

- `public_key = Base64 encoded X25519 public key`
- после `base64 decode` длина должна быть ровно `32 bytes`

Это относится к:

- `POST /api/v1/e2ee/keys`
- `POST /api/v1/e2ee/device/register`
- `POST /api/v1/web/pairing/sessions`

Практическое правило для frontend:

- отправляйте обычный padded Base64
- не отправляйте hex
- не отправляйте JWK
- не отправляйте PEM

### 3.2 Backup contract

`GET /api/v1/e2ee/backup` возвращает encrypted blob плюс explicit restore metadata.

Для current canonical backup этот response нужно трактовать как deterministic contract.

Для legacy `pbkdf2` rows, где metadata была восстановлена через migration backfill и runtime inference, этот response нужно трактовать как compatibility contract, а не как самостоятельное cryptographic proof того, что historical backup обязательно расшифруется сегодня.

Canonical значения:

- `backup_key_type = x25519`
- `backup_key_format = pkcs8-der-base64`
- `backup_key_scope = device_identity`
- `backup_format_version = 1`
- `cipher_algorithm = aes-256-gcm`
- `cipher_tag_embedded = true`
- `aad_mode = none`
- `password_processing = utf8-raw`

Это значит:

- plaintext внутри backup относится к `X25519 private identity key`
- plaintext перед AES-GCM сериализован как `pkcs8-der-base64`
- пароль нельзя trim-ить или normalize-ить по-своему
- нужно брать raw UTF-8 bytes строки пароля

Legacy note:

- для старых backup backend может вернуть `backup_key_format = raw-32-bytes`
- в этом случае после decrypt frontend должен трактовать plaintext как raw `32-byte X25519 private key`
- такой backup нельзя импортировать как `pkcs8`
- если decrypt не проходит даже по backend-declared metadata, не добавляйте guessing fallback поверх current contract
- в таком случае пользователь должен получить 2 safe-path варианта:
  - `fresh web key`
  - `QR linked-device flow`

### 3.3 Что значит `device_identity`

`backup_key_scope = device_identity` означает:

- backup можно использовать в обычном password login flow
- restored private key можно привязать к новому web browser slot
- если `public_key` совпадает с историческим identity, старая история может открываться без QR

## 4. Что frontend должен хранить локально

Минимум:

- стабильный `web_device_id` для текущего browser slot
- текущую web key pair или ссылку на нее в `IndexedDB`
- `access_token` и `refresh_token`
- флаг, был ли этот browser зарегистрирован как linked E2EE device

Рекомендуется:

- хранить `web_device_id` в `localStorage`
- хранить private key material в `IndexedDB`
- после `device/register` и после `redeem` всегда заменять токены на новые из ответа

Важно:

- токены из `POST /auth/login` еще не являются linked-device токенами
- linked-device контекст появляется после:
  - `POST /api/v1/e2ee/device/register`
  - или `POST /api/v1/web/pairing/sessions/{pairing_id}/redeem`

Именно эти токены потом должны использоваться для chat API и websocket.

## 5. Общие переменные для примеров

```bash
BASE_URL="http://localhost:8080/api/v1"
ACCESS_TOKEN="<ACCESS_TOKEN>"
REFRESH_TOKEN="<REFRESH_TOKEN>"
WEB_DEVICE_ID="web-chrome-macbook-slot-1"
WEB_PUBLIC_KEY="BASE64_X25519_PUBLIC_KEY_32_BYTES"
```

Для защищенных запросов:

```bash
-H "Authorization: Bearer $ACCESS_TOKEN"
-H "Content-Type: application/json"
```

Во всех примерах ниже `ACCESS_TOKEN` означает текущий актуальный токен.
После `device/register` и после `redeem` его нужно заменить на новый токен из последнего ответа.

## 6. Flow 1. Обычный login с восстановлением старой истории

Это основной flow для пользователей, у которых нет доступа к mobile app, но им нужна старая E2EE история.

### Шаг 1. Login

```bash
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "StrongPassword123"
  }'
```

Пример ответа:

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expires_at": "2026-04-05T11:00:00Z"
}
```

### Шаг 2. Получить backup

```bash
curl "$BASE_URL/e2ee/backup" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Если backup есть, пример ответа:

```json
{
  "user_id": 42,
  "encrypted_private_key": "BASE64_AES_GCM_CIPHERTEXT",
  "salt": "BASE64_SALT",
  "iv": "BASE64_IV",
  "kdf_algorithm": "argon2id",
  "kdf_params": {
    "memory_kib": 65536,
    "parallelism": 4,
    "key_length": 32
  },
  "version": 1,
  "backup_key_type": "x25519",
  "backup_key_format": "pkcs8-der-base64",
  "backup_key_scope": "device_identity",
  "backup_format_version": 1,
  "cipher_algorithm": "aes-256-gcm",
  "cipher_tag_embedded": true,
  "aad_mode": "none",
  "password_processing": "utf8-raw",
  "created_at": "2026-04-01T09:00:00Z",
  "updated_at": "2026-04-05T08:30:00Z"
}
```

Если backup не существует:

- backend вернет `204 No Content`
- body будет пустой
- не пытайтесь делать `response.json()` на этом ответе

### Шаг 3. Локально расшифровать backup

Frontend делает это полностью локально:

1. Берет введенный master password
2. Преобразует пароль как `utf8-raw`
3. Строит symmetric key через `kdf_algorithm + kdf_params`
4. Дешифрует `encrypted_private_key` через `aes-256-gcm`
5. Использует `iv`
6. Учитывает, что `cipher_tag_embedded = true`
7. Использует `aad_mode = none`
8. Получает plaintext формата, который задан в `backup_key_format`
9. Если `backup_key_format = pkcs8-der-base64`, импортирует private key как `X25519`
10. Если `backup_key_format = raw-32-bytes`, трактует plaintext как raw `32-byte X25519 private key` и сначала нормализует его в importable representation
11. Из private key детерминированно вычисляет `public_key`

Важно:

- master password никогда не отправляется на backend
- если пароль неверный, ошибка должна оставаться чисто клиентской
- если дешифровка или import key не прошли, не отправляйте guessed `public_key`

### Шаг 4. Зарегистрировать web device с восстановленным identity key

```bash
curl -X POST "$BASE_URL/e2ee/device/register" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "web-chrome-macbook-slot-1",
    "public_key": "BASE64_RESTORED_X25519_PUBLIC_KEY",
    "device_name": "Chrome on macOS",
    "platform": "web",
    "replace_other_web_sessions": true,
    "include_backup": false
  }'
```

Пример ответа:

```json
{
  "device_id": "web-chrome-macbook-slot-1",
  "message": "device registered successfully",
  "has_backup": true,
  "backup_algo": "argon2id",
  "user": {
    "id": 42,
    "email": "user@example.com",
    "username": "askar",
    "first_name": "Askar",
    "last_name": "Abylkhaiyrov"
  },
  "current_login": {
    "ip": "203.0.113.10",
    "country": "KZ",
    "city": "Almaty",
    "user_agent": "Mozilla/5.0 ..."
  },
  "revoked_device_ids": [],
  "replace_other_web_sessions": true,
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expires_at": "2026-04-05T11:05:00Z"
}
```

После этого frontend обязан:

1. заменить старые login токены на `access_token` и `refresh_token` из этого ответа
2. сохранить `device_id`
3. использовать именно эти linked-device токены для chat API и websocket

### Шаг 5. Читать старую историю

Теперь обычное чтение чатов может уже открыть и старую E2EE историю.

Пример:

```bash
curl "$BASE_URL/conversations/550e8400-e29b-41d4-a716-446655440000/messages?limit=20&offset=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Web-Device-ID: $WEB_DEVICE_ID"
```

Пример ответа:

```json
{
  "messages": [
    {
      "id": "74c5a83b-9e8c-4c9f-bff8-79f3d4e8c1ab",
      "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
      "sender_id": 7,
      "content": "BASE64_CIPHERTEXT",
      "content_hash": "sha256:...",
      "encrypted_keys": {
        "web-chrome-macbook-slot-1": "BASE64_WRAPPED_MESSAGE_KEY"
      },
      "type": "text",
      "is_edited": false,
      "is_forwarded": false,
      "is_deleted": false,
      "created_at": "2026-04-03T10:00:00Z",
      "updated_at": "2026-04-03T10:00:00Z",
      "sender_username": "alice",
      "sender_full_name": "Alice Example",
      "read_by_count": 1,
      "delivered_count": 1,
      "is_read": true,
      "reactions": []
    }
  ],
  "count": 1
}
```

Что здесь важно:

- backend смотрит текущий linked `device_id`
- если находит старые сообщения, зашифрованные для другого `device_id`, но с тем же `public_key`, он может отдать envelope под текущий `device_id`
- frontend дальше работает как с обычным `encrypted_keys[current_device_id]`
- `X-Web-Device-ID` можно передавать для явности, но при linked-device токене backend обычно уже знает нужный `device_id`

## 7. Flow 2. Обычный login с fresh web key

Этот flow подходит, если:

- старая история не обязательна сразу
- нужно быстро открыть новый browser slot
- пользователь не знает master password

### Шаги

1. Login через `/auth/login`
2. Генерируем новый X25519 key pair
3. Вызываем `/e2ee/device/register`
4. Заменяем токены на linked-device токены из ответа
5. Работаем с новыми сообщениями

Пример:

```bash
curl -X POST "$BASE_URL/e2ee/device/register" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "web-chrome-macbook-slot-1",
    "public_key": "BASE64_FRESH_X25519_PUBLIC_KEY",
    "device_name": "Chrome on macOS",
    "platform": "web",
    "replace_other_web_sessions": true,
    "include_backup": true
  }'
```

Пример ответа:

```json
{
  "device_id": "web-chrome-macbook-slot-1",
  "message": "device registered successfully",
  "has_backup": true,
  "backup_algo": "argon2id",
  "backup": {
    "encrypted_private_key": "BASE64_AES_GCM_CIPHERTEXT",
    "salt": "BASE64_SALT",
    "iv": "BASE64_IV",
    "kdf_algorithm": "argon2id",
    "kdf_params": {
      "memory_kib": 65536,
      "parallelism": 4,
      "key_length": 32
    },
    "version": 1,
    "backup_key_type": "x25519",
    "backup_key_format": "pkcs8-der-base64",
    "backup_key_scope": "device_identity",
    "backup_format_version": 1,
    "cipher_algorithm": "aes-256-gcm",
    "cipher_tag_embedded": true,
    "aad_mode": "none",
    "password_processing": "utf8-raw"
  },
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expires_at": "2026-04-05T11:05:00Z"
}
```

Семантика этого flow:

- новые сообщения начнут шифроваться на текущий `device_id`
- старая история автоматически не гарантируется
- для старой истории нужен:
  - либо поздний restore identity key
  - либо QR pairing + history sync

## 8. Flow 3. QR pairing

Это fallback или отдельный flow, если:

- пользователь хочет именно linked-device onboarding через trusted mobile
- браузер использует fresh key
- нужно гарантированно получить старую историю через re-wrap

### Шаг 1. Web создает pairing session

```bash
curl -X POST "$BASE_URL/web/pairing/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "web_device_id": "web-chrome-macbook-slot-1",
    "web_public_key": "BASE64_FRESH_X25519_PUBLIC_KEY"
  }'
```

Пример ответа:

```json
{
  "pairing_id": "5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a",
  "qr_token": "qr_secret_value",
  "session_token": "session_secret_value",
  "web_device_id": "web-chrome-macbook-slot-1",
  "web_public_key": "BASE64_FRESH_X25519_PUBLIC_KEY",
  "status": "pending",
  "expires_at": "2026-04-05T11:01:30Z",
  "qr_payload": {
    "type": "web_pairing",
    "pairing_id": "5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a",
    "qr_token": "qr_secret_value",
    "web_device_id": "web-chrome-macbook-slot-1",
    "web_public_key": "BASE64_FRESH_X25519_PUBLIC_KEY",
    "expires_at": "2026-04-05T11:01:30Z"
  }
}
```

Frontend на web:

- показывает QR
- сохраняет `pairing_id`
- сохраняет `session_token`
- начинает polling статуса

### Шаг 2. Web polling статуса

```bash
curl "$BASE_URL/web/pairing/sessions/5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a?session_token=session_secret_value"
```

Пример ответа:

```json
{
  "pairing_id": "5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a",
  "web_device_id": "web-chrome-macbook-slot-1",
  "status": "approved",
  "approved": true,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-04-05T11:01:30Z",
  "approved_at": "2026-04-05T11:00:45Z"
}
```

### Шаг 3. Mobile preview

```bash
curl -X POST "$BASE_URL/e2ee/web/pairing/sessions/5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a/preview" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "qr_secret_value"
  }'
```

Пример ответа:

```json
{
  "pairing_id": "5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a",
  "web_device_id": "web-chrome-macbook-slot-1",
  "web_public_key": "BASE64_FRESH_X25519_PUBLIC_KEY",
  "request_ip": "203.0.113.10",
  "request_country": "KZ",
  "request_city": "Almaty",
  "request_user_agent": "Mozilla/5.0 ...",
  "expires_at": "2026-04-05T11:01:30Z",
  "status": "pending",
  "created_at": "2026-04-05T11:00:00Z"
}
```

### Шаг 4. Mobile approve

```bash
curl -X POST "$BASE_URL/e2ee/web/pairing/sessions/5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a/approve" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "qr_secret_value",
    "web_device_id": "web-chrome-macbook-slot-1",
    "web_public_key": "BASE64_FRESH_X25519_PUBLIC_KEY",
    "device_name": "Chrome on macOS",
    "platform": "web",
    "history_sync": true
  }'
```

Пример ответа:

```json
{
  "pairing_id": "5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a",
  "web_device_id": "web-chrome-macbook-slot-1",
  "status": "approved",
  "approved": true,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-04-05T11:01:30Z",
  "approved_at": "2026-04-05T11:00:45Z"
}
```

Важно:

- `history_sync: true` не заменяет сам history upload
- для старой истории mobile все равно должен отдельно вызвать `/history`

### Шаг 5. Mobile отправляет re-wrapped history keys

```bash
curl -X POST "$BASE_URL/e2ee/web/pairing/sessions/5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a/history" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "web_device_id": "web-chrome-macbook-slot-1",
    "items": [
      {
        "message_id": "74c5a83b-9e8c-4c9f-bff8-79f3d4e8c1ab",
        "encrypted_key_for_web": "BASE64_WRAPPED_MESSAGE_KEY_FOR_WEB"
      }
    ]
  }'
```

Пример ответа:

```json
{
  "pairing_id": "5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a",
  "web_device_id": "web-chrome-macbook-slot-1",
  "status": "synced",
  "synced_count": 1,
  "synced_at": "2026-04-05T11:00:55Z"
}
```

### Шаг 6. Web redeem

```bash
curl -X POST "$BASE_URL/web/pairing/sessions/5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "session_secret_value"
  }'
```

Пример ответа:

```json
{
  "pairing_id": "5a8cf4c2-15f1-42e8-a87b-cf6fc2d86c8a",
  "web_device_id": "web-chrome-macbook-slot-1",
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expires_at": "2026-04-05T11:05:00Z"
}
```

После этого:

- frontend заменяет текущие токены на токены из redeem response
- web начинает работать как linked device
- история, загруженная через `/history`, становится доступной

## 9. Endpoint для отправителя: получить public keys получателя

Перед E2EE отправкой нужно получить все активные device keys собеседника.

```bash
curl "$BASE_URL/e2ee/keys/42" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Пример ответа:

```json
{
  "user_id": 42,
  "keys": {
    "mobile-device-1": "BASE64_X25519_PUBLIC_KEY_1",
    "web-chrome-macbook-slot-1": "BASE64_X25519_PUBLIC_KEY_2"
  }
}
```

Frontend должен:

1. сгенерировать random message key
2. зашифровать plaintext сообщения этим message key
3. отдельно завернуть message key на каждый `device_id`
4. отправить карту wrapped keys

Для personal chat request body содержит поле `keys`.

Пример:

```bash
curl -X POST "$BASE_URL/conversations/550e8400-e29b-41d4-a716-446655440000/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "BASE64_MESSAGE_CIPHERTEXT",
    "content_hash": "sha256:PLAINTEXT_HASH",
    "keys": {
      "mobile-device-1": "BASE64_WRAPPED_KEY_FOR_MOBILE",
      "web-chrome-macbook-slot-1": "BASE64_WRAPPED_KEY_FOR_WEB"
    },
    "type": "text"
  }'
```

## 10. Управление linked devices

### Получить список устройств

```bash
curl "$BASE_URL/e2ee/devices" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Пример ответа:

```json
{
  "devices": [
    {
      "user_id": 42,
      "device_id": "web-chrome-macbook-slot-1",
      "public_key": "BASE64_X25519_PUBLIC_KEY",
      "device_name": "Chrome on macOS",
      "platform": "web",
      "status": "trusted",
      "trusted_at": "2026-04-05T11:00:45Z",
      "last_seen_at": "2026-04-05T11:03:00Z",
      "last_login_at": "2026-04-05T11:00:45Z",
      "linked_ip": "203.0.113.10",
      "linked_country": "KZ",
      "linked_city": "Almaty",
      "user_agent": "Mozilla/5.0 ...",
      "created_at": "2026-04-05T11:00:45Z"
    }
  ],
  "count": 1
}
```

### Отозвать устройство

```bash
curl -X DELETE "$BASE_URL/e2ee/devices/web-chrome-macbook-slot-1" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Пример ответа:

```json
{
  "message": "linked device revoked"
}
```

## 11. Ошибки, о которых frontend должен помнить

### 11.1 Invalid public key

Пример:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "public_key must decode to 32-byte x25519 public key",
    "details": null
  }
}
```

### 11.2 Нет backup

Сценарий:

- `GET /e2ee/backup` вернул `204`

Это не ошибка.
Это означает только то, что restore flow невозможен для этого пользователя.

### 11.3 QR истек

Пример:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "QR code has expired. Please refresh the login page and scan a new QR code.",
    "details": null
  }
}
```

### 11.4 Нельзя использовать старые токены после linked onboarding

Если frontend продолжит использовать старые токены из `/auth/login`, а не новые токены из:

- `/e2ee/device/register`
- или `/web/pairing/sessions/{pairing_id}/redeem`

то linked-device context может отсутствовать.
В таком состоянии E2EE history behavior будет неполным или неожиданным.

## 12. Рекомендуемая frontend стратегия

Самый практичный вариант:

1. На login screen спросить, нужен ли доступ к старой E2EE истории
2. Если да, сначала делать `GET /e2ee/backup`
3. Если backup есть, просить master password до `device/register`
4. Если restore успешен, регистрировать device с восстановленным `public_key`
5. Если restore невозможен, предлагать:
   - продолжить с fresh key
   - или сделать QR pairing
6. После `device/register` или `redeem` всегда обновлять локальные токены
7. Для history requests использовать linked-device токены
8. Для надежности можно также прокидывать `X-Web-Device-ID`

## 13. Checklist для frontend

- Есть стабильный `web_device_id` на browser slot
- Есть генерация X25519 key pair
- `public_key` отправляется как Base64 и декодируется в `32 bytes`
- `GET /e2ee/backup` корректно обрабатывает `204 No Content`
- Master password никогда не уходит на backend
- Restore flow делает local decrypt и поддерживает import `pkcs8-der-base64` и legacy `raw-32-bytes`
- После `device/register` токены заменяются на linked-device токены
- После `redeem` токены тоже заменяются
- Перед E2EE send фронт получает `/e2ee/keys/{user_id}`
- Для personal message send используется карта `keys`
- Для старой истории с fresh key предусмотрен QR fallback

## 14. Итог

Если frontend хочет открыть старую E2EE историю уже при обычном login, правильный путь такой:

1. `login`
2. `get backup`
3. local decrypt
4. derive restored `public_key`
5. `device/register` с восстановленным key
6. заменить токены на linked-device токены
7. читать чаты обычным chat API

Если restore сделать нельзя, тогда:

1. `login`
2. `device/register` с fresh key
3. заменить токены
4. новые сообщения работают сразу
5. старая история идет через `QR + history sync`
