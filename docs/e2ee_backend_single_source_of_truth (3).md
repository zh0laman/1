# E2EE Backend Single Source Of Truth

Актуально по состоянию на `2026-04-05`.

Этот документ нужен как один канонический `.md` файл, в котором по шагам объяснено:

- какая у нас E2EE-модель
- что именно backend гарантирует
- что означает backup
- как работает password login на web
- как работает QR linked-device flow
- когда доступна старая история, а когда нет
- какие endpoint-ы вызывать
- какие payload/response ожидать

Если между старыми документами есть расхождения, canonical считать именно этот файл.

---

## 1. Короткий итог

### Что уже зафиксировано backend-ом

- `public_key` устройства должен быть `Base64 encoded X25519 public key`
- после `base64 decode` длина должна быть ровно `32 bytes`
- `GET /api/v1/e2ee/backup` возвращает не только ciphertext, но и explicit metadata
- legacy `pbkdf2-sha256` version `1` получает deterministic backfill для `kdf_params`
- web считается отдельным устройством
- новый web device не получает старую историю автоматически только потому, что у него есть backup

### Главная canonical идея

- `web` всегда имеет свой собственный `device_id`
- ordinary login поддерживает 2 режима:
  - `fresh web key`
  - `restored identity key from backup`
- если login использует `fresh web key`, старая история требует `QR approve + history sync`
- если login использует `restored identity key`, старая история может быть доступна и без QR
- backup теперь нужно трактовать как deterministic identity-restore contract

---

## 2. Каноническая архитектурная модель

### 2.1 Что хранит backend

Backend хранит:

- `user_public_keys`
  - публичные ключи устройств
- `messages.content`
  - ciphertext сообщения
- `messages.encrypted_keys`
  - per-device wrapped message keys
- `user_key_backups`
  - зашифрованный backup приватного ключевого материала

Backend не хранит:

- master password
- plaintext сообщений
- расшифрованный private key

### 2.2 Что считается устройством

Устройство в этой модели это любой client slot со своим:

- `device_id`
- `public_key`
- `private_key`

Это относится и к:

- mobile
- web browser

То есть web не является "расширением mobile". Web является отдельным устройством.

### 2.3 Почему backup не равен old history

Старые сообщения уже были сохранены с `encrypted_keys[device_id]` для устройств, которые существовали на момент отправки.

Если новый web device логинится с `fresh key`, то у старых сообщений обычно:

- нет `encrypted_keys[current_web_device_id]`

Поэтому такой web browser не сможет прочитать старую историю, пока:

- mobile не сделает `history sync / re-wrap`

Но если login-browser восстановил тот же private identity key, который уже использовался раньше, то старые envelopes этого же `public_key` могут быть прочитаны и без QR.

---

## 3. Canonical crypto contract

### 3.1 Device public key

Backend ожидает:

- `public_key = Base64 encoded X25519 public key`
- после decode длина = `32 bytes`

Это правило действует для:

- `POST /api/v1/e2ee/keys`
- `POST /api/v1/e2ee/device/register`
- `POST /api/v1/web/pairing/sessions`

### 3.2 Backup contract

`GET /api/v1/e2ee/backup` возвращает explicit restore metadata.

Для current canonical backup это нужно считать deterministic contract.

Для legacy `pbkdf2` rows, где metadata была восстановлена через migration backfill, normalization и runtime inference, этот response нужно считать compatibility contract, а не самостоятельным cryptographic proof того, что historical backup точно расшифруется today.

Canonical значения:

- `backup_key_type = x25519`
- `backup_key_format = pkcs8-der-base64`
- `backup_key_scope = device_identity`
- `backup_format_version = 1`
- `cipher_algorithm = aes-256-gcm`
- `cipher_tag_embedded = true`
- `aad_mode = none`
- `password_processing = utf8-raw`

Legacy exception:

- старые `pbkdf2-sha256` backup могут возвращаться как `backup_key_format = raw-32-bytes`
- это означает, что после decrypt клиент получает raw `32-byte X25519 private key`
- такой legacy backup нельзя импортировать как `pkcs8`

### 3.3 Что означает `backup_key_scope = device_identity`

Это означает:

- backup описывает восстановимый identity key
- frontend может использовать этот key в обычном login flow
- если restored `public_key` совпадает с исторической identity, old history может быть доступна без QR
- если frontend вместо этого генерирует fresh web key, old history потребует QR history sync

---

## 4. Base URL и общие заголовки

```bash
BASE_URL="http://localhost:8080/api/v1"
ACCESS_TOKEN="<JWT_ACCESS_TOKEN>"
```

Для защищенных endpoint-ов:

```bash
-H "Authorization: Bearer $ACCESS_TOKEN"
```

Для JSON:

```bash
-H "Content-Type: application/json"
```

---

## 5. Endpoint summary

### Public

- `POST /api/v1/web/pairing/sessions`
- `GET /api/v1/web/pairing/sessions/{pairing_id}?session_token=...`
- `POST /api/v1/web/pairing/sessions/{pairing_id}/redeem`

### Protected

- `POST /api/v1/e2ee/keys`
- `GET /api/v1/e2ee/keys/{user_id}`
- `POST /api/v1/e2ee/backup`
- `GET /api/v1/e2ee/backup`
- `DELETE /api/v1/e2ee/backup`
- `POST /api/v1/e2ee/device/register`
- `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/preview`
- `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/approve`
- `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/reject`
- `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/history`
- `GET /api/v1/e2ee/devices`
- `DELETE /api/v1/e2ee/devices/{device_id}`

---

## 6. Flow A. Загрузка device public key

Этот flow нужен для обычной multi-device E2EE модели.

### Request

```bash
curl -X POST "$BASE_URL/e2ee/keys" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "mobile-device-1",
    "public_key": "BASE64_X25519_PUBLIC_KEY_32_BYTES"
  }'
```

### Success response

```json
{
  "message": "public key uploaded successfully"
}
```

### Backend semantics

- backend валидирует `public_key`
- ключ сохраняется как ключ этого `device_id`
- новые отправители смогут шифровать `message_key` и для этого устройства

### Когда вызывать

- mobile после генерации keys
- mobile после reinstall
- любое новое устройство после появления нового key pair

---

## 7. Flow B. Получить public keys пользователя

Нужно перед отправкой сообщения.

### Request

```bash
curl "$BASE_URL/e2ee/keys/42" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Success response

```json
{
  "user_id": 42,
  "keys": {
    "mobile-device-1": "BASE64_X25519_PUBLIC_KEY_1",
    "web-device-1": "BASE64_X25519_PUBLIC_KEY_2"
  }
}
```

### Backend semantics

- backend возвращает активные device public keys пользователя
- sender обязан шифровать `message_key` для каждого целевого `device_id`

---

## 8. Flow C. Сохранить backup

Backup шифруется клиентом до отправки на backend.

### Request

```bash
curl -X POST "$BASE_URL/e2ee/backup" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted_private_key": "BASE64_AES_GCM_CIPHERTEXT",
    "salt": "BASE64_SALT",
    "iv": "BASE64_IV",
    "kdf_algorithm": "pbkdf2-sha256",
    "kdf_params": {
      "iterations": 310000,
      "hash": "sha256",
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
  }'
```

### Success response

```json
{
  "message": "key backup saved successfully"
}
```

### Backend semantics

- backend хранит только encrypted blob
- backend не знает master password
- backend не расшифровывает private key
- если metadata не указана явно, backend нормализует ее к canonical значениям

---

## 9. Flow D. Получить backup

### Request

```bash
curl "$BASE_URL/e2ee/backup" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Success response `200 OK`

```json
{
  "user_id": 42,
  "encrypted_private_key": "BASE64_AES_GCM_CIPHERTEXT",
  "salt": "BASE64_SALT",
  "iv": "BASE64_IV",
  "kdf_algorithm": "pbkdf2-sha256",
  "kdf_params": {
    "iterations": 310000,
    "hash": "sha256",
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
  "created_at": "2026-04-05T10:00:00Z",
  "updated_at": "2026-04-05T10:00:00Z"
}
```

### Response `204 No Content`

Это означает только одно:

- backup не создан

Это не означает:

- что у пользователя нет E2EE
- что old history недоступна по QR flow

### Как frontend должен трактовать backup

Frontend должен:

- брать `kdf_algorithm` и `kdf_params` только из ответа backend
- импортировать private key только по `backup_key_type + backup_key_format`
- не угадывать `iterations`, `hash`, `memory_kib`, `parallelism`
- не угадывать формат key material

Если формат не поддерживается клиентом:

- считать backup `unsupported`

---

## 10. Flow E. Удалить backup

### Request

```bash
curl -X DELETE "$BASE_URL/e2ee/backup" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Success response

```json
{
  "message": "key backup deleted successfully"
}
```

---

## 11. Flow F. Password login для web

Это flow для двух режимов:

- нового browser slot
- новых сообщений
- быстрого входа в web
- optional old-history access через restored identity key

### Шаг 1. Пользователь логинится

Пример:

```bash
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "StrongPassword123"
  }'
```

### Шаг 2. Web выбирает один из двух режимов

#### Вариант F1. Fresh web key

Web:

- генерирует новый `device_id`
- генерирует новый `X25519 key pair`

Этот режим:

- сразу открывает новые сообщения
- не гарантирует old history

#### Вариант F2. Restored identity key from backup

Web:

- получает `GET /e2ee/backup`
- локально расшифровывает backup через master password
- восстанавливает historical private identity key
- вычисляет corresponding `public_key`
- регистрирует текущий browser `device_id` с этим же `public_key`

Этот режим:

- позволяет обычному login-browser читать old history без QR, если restored key совпадает с исторической identity
- не требует mobile app
- позволяет backend при чтении истории подставлять equivalent old envelope под текущий `device_id`, если `public_key` тот же

### Важно

Даже в restored mode у текущего browser остается свой собственный `device_id`.

Отдельный `device_id` и одинаковый `public_key` здесь допустимы и intentionally supported для password-based history restore.

### Шаг 3. Web регистрирует себя как устройство

### Request

```bash
curl -X POST "$BASE_URL/e2ee/device/register" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Web-Device-ID: web-device-1" \
  -d '{
    "device_id": "web-device-1",
    "public_key": "BASE64_X25519_PUBLIC_KEY_32_BYTES_OR_RESTORED_IDENTITY_PUBLIC_KEY",
    "device_name": "Chrome on macOS",
    "platform": "web",
    "replace_other_web_sessions": true,
    "include_backup": true
  }'
```

### Success response

```json
{
  "device_id": "web-device-1",
  "message": "device registered successfully",
  "has_backup": true,
  "backup_algo": "pbkdf2-sha256",
  "backup": {
    "user_id": 42,
    "encrypted_private_key": "BASE64_AES_GCM_CIPHERTEXT",
    "salt": "BASE64_SALT",
    "iv": "BASE64_IV",
    "kdf_algorithm": "pbkdf2-sha256",
    "kdf_params": {
      "iterations": 310000,
      "hash": "sha256",
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
    "created_at": "2026-04-05T10:00:00Z",
    "updated_at": "2026-04-05T10:00:00Z"
  },
  "user": {
    "id": 42,
    "email": "user@example.com",
    "username": "user42",
    "first_name": "User",
    "last_name": "Example"
  },
  "current_login": {
    "ip": "203.0.113.10",
    "country": "KZ",
    "city": "Almaty",
    "user_agent": "Mozilla/5.0 ..."
  },
  "revoked_device_ids": ["old-web-device-1"],
  "replace_other_web_sessions": true,
  "access_token": "LINKED_DEVICE_ACCESS_TOKEN",
  "refresh_token": "LINKED_DEVICE_REFRESH_TOKEN",
  "token_type": "Bearer",
  "expires_in": 300,
  "expires_at": "2026-04-05T10:05:00Z"
}
```

### Что это означает

- текущий браузер зарегистрирован как новое устройство
- новые сообщения теперь будут шифроваться и для этого `device_id`
- backend может вернуть backup для explicit recovery flows
- если login использовал fresh key, old history все еще не гарантирована
- если login использовал restored identity key, old history может быть доступна сразу

### Что frontend должен сделать после ответа

- заменить bootstrap токены на токены из `/e2ee/device/register`
- сохранить `device_id`
- открыть websocket
- продолжить обычный chat flow

### Что НЕ нужно обещать пользователю

Нельзя говорить без условия:

- "любой login всегда сразу открывает старую историю"

Правильно говорить:

- "если вы входите с восстановленным identity key из backup, старая история может быть доступна сразу"
- "если вход идет с новым web key, старая история подключается через QR history sync"

---

## 12. Flow G. QR linked-device flow для old history

Это canonical flow для:

- нового web browser
- старой истории
- trust establishment между mobile и web
- случая, когда login использует fresh web key

### Состояния pairing session

- `pending`
- `approved`
- `synced`
- `redeemed`
- `revoked`
- `expired`

---

## 13. Шаг G1. Web создает pairing session

### Request

```bash
curl -X POST "$BASE_URL/web/pairing/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "web_device_id": "web-device-1",
    "web_public_key": "BASE64_X25519_PUBLIC_KEY_32_BYTES",
    "ttl_seconds": 90
  }'
```

### Success response `201 Created`

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "qr_token": "opaque-qr-token",
  "session_token": "opaque-session-token",
  "web_device_id": "web-device-1",
  "web_public_key": "BASE64_X25519_PUBLIC_KEY_32_BYTES",
  "status": "pending",
  "expires_at": "2026-04-05T10:01:30Z",
  "qr_payload": {
    "type": "web_pairing",
    "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
    "qr_token": "opaque-qr-token",
    "web_device_id": "web-device-1",
    "web_public_key": "BASE64_X25519_PUBLIC_KEY_32_BYTES",
    "expires_at": "2026-04-05T10:01:30Z"
  }
}
```

### Что делает web

- рендерит QR
- сохраняет `session_token`
- начинает polling статуса

---

## 14. Шаг G2. Web poll статуса pairing session

### Request

```bash
curl "$BASE_URL/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f?session_token=opaque-session-token"
```

### Success response

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "web-device-1",
  "status": "approved",
  "approved": true,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-04-05T10:01:30Z",
  "approved_at": "2026-04-05T10:00:50Z"
}
```

### Как трактовать статусы

- `pending`
  - ждем scan/approve
- `approved`
  - trust уже установлен, но старая история может еще не быть перенесена
- `synced`
  - history sync завершен
- `redeemed`
  - web уже получил backend session
- `revoked`
  - pairing отклонен
- `expired`
  - QR устарел, нужен новый

---

## 15. Шаг G3. Mobile preview перед approve

### Request

```bash
curl -X POST "$BASE_URL/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/preview" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "opaque-qr-token"
  }'
```

### Success response

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "web-device-1",
  "web_public_key": "BASE64_X25519_PUBLIC_KEY_32_BYTES",
  "request_ip": "203.0.113.10",
  "request_country": "KZ",
  "request_city": "Almaty",
  "request_user_agent": "Mozilla/5.0 ... Chrome/136.0",
  "expires_at": "2026-04-05T10:01:30Z",
  "status": "pending",
  "created_at": "2026-04-05T10:00:00Z"
}
```

### Зачем это нужно

Чтобы mobile UI показал пользователю:

- какой браузер просит доступ
- из какого IP/города
- когда был создан запрос

---

## 16. Шаг G4. Mobile approve

### Request

```bash
curl -X POST "$BASE_URL/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/approve" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "opaque-qr-token",
    "web_device_id": "web-device-1",
    "web_public_key": "BASE64_X25519_PUBLIC_KEY_32_BYTES",
    "device_name": "Chrome on MacBook Pro",
    "platform": "web",
    "history_sync": true
  }'
```

### Success response

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "web-device-1",
  "status": "approved",
  "approved": true,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-04-05T10:01:30Z",
  "approved_at": "2026-04-05T10:00:50Z"
}
```

### Что это означает

- устройство доверено
- `web_device_id` привязан к пользователю
- новые сообщения уже могут шифроваться на этот web device
- старая история все еще требует `history sync`

---

## 17. Шаг G5. Mobile reject

### Request

```bash
curl -X POST "$BASE_URL/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/reject" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "opaque-qr-token"
  }'
```

### Success response

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "web-device-1",
  "status": "revoked",
  "approved": false,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-04-05T10:01:30Z"
}
```

---

## 18. Шаг G6. Mobile history sync

На этом шаге mobile:

1. берет старые сообщения
2. расшифровывает старый `message_key`
3. шифрует этот же `message_key` на `web_device_id`
4. отправляет backend новый wrapped key

### Request

```bash
curl -X POST "$BASE_URL/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/history" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "web_device_id": "web-device-1",
    "items": [
      {
        "message_id": "5a1f0db3-5b52-4989-a5be-6bbf1c3d65d0",
        "encrypted_key_for_web": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"ciphertext\":\"...\"}"
      }
    ]
  }'
```

### Success response

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "web-device-1",
  "status": "synced",
  "synced_count": 1,
  "synced_at": "2026-04-05T10:01:05Z"
}
```

### Что backend делает

- не меняет `content`
- не знает plaintext
- только дописывает `encrypted_keys[web_device_id]`

---

## 19. Шаг G7. Web redeem session

Когда pairing завершен, web обменивает `session_token` на backend auth tokens.

### Request

```bash
curl -X POST "$BASE_URL/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "opaque-session-token"
  }'
```

### Success response

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "web-device-1",
  "access_token": "LINKED_DEVICE_ACCESS_TOKEN",
  "refresh_token": "LINKED_DEVICE_REFRESH_TOKEN",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expires_at": "2026-04-05T11:00:00Z"
}
```

Дополнительно backend ставит cookies:

- `access_token`
- `refresh_token`

---

## 20. Flow H. List linked devices

### Request

```bash
curl "$BASE_URL/e2ee/devices" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Success response

```json
{
  "devices": [
    {
      "user_id": 42,
      "device_id": "web-device-1",
      "public_key": "BASE64_X25519_PUBLIC_KEY_32_BYTES",
      "device_name": "Chrome on MacBook Pro",
      "platform": "web",
      "status": "trusted",
      "trusted_at": "2026-04-05T10:00:50Z",
      "last_login_at": "2026-04-05T10:01:10Z",
      "linked_ip": "203.0.113.10",
      "linked_country": "KZ",
      "linked_city": "Almaty",
      "last_ip": "203.0.113.10",
      "last_country": "KZ",
      "last_city": "Almaty",
      "user_agent": "Mozilla/5.0 ... Chrome/136.0",
      "last_seen_at": "2026-04-05T10:01:10Z",
      "created_at": "2026-04-05T10:00:00Z"
    }
  ],
  "count": 1
}
```

---

## 21. Flow I. Revoke linked device

### Request

```bash
curl -X DELETE "$BASE_URL/e2ee/devices/web-device-1" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Success response

```json
{
  "message": "linked device revoked"
}
```

### Что это означает

- устройство отозвано
- связанные web sessions должны быть завершены
- при следующем использовании нужен новый pairing flow

---

## 22. Что гарантирует password login, а что нет

### Password login гарантирует

- пользователь вошел
- новый web device зарегистрирован
- новые сообщения будут шифроваться на новый `web_device_id`
- backend может вернуть backup metadata

### Password login НЕ гарантирует

- старую историю на новом web device
- автоматический re-wrap старых сообщений
- reuse старой identity на новом browser slot

---

## 23. Что гарантирует QR linked-device flow

### После approve

Гарантируется:

- trust между mobile и web
- новый web device привязан к пользователю
- новые сообщения уже могут шифроваться на него

### После history sync

Гарантируется:

- старые сообщения могут начать содержать `encrypted_keys[current_web_device_id]`
- web сможет расшифровывать old history

---

## 24. Error handling

Ожидаемые ошибки:

- `400`
  - invalid request body
  - invalid `pairing_id`
  - invalid `public_key`
  - invalid `web_public_key`
- `401`
  - пользователь не авторизован
- `403`
  - попытка трогать чужую pairing session
- `404`
  - pairing session не найдена
- `500`
  - внутренняя ошибка backend

### Частые validation cases

- `public_key is required`
- `public_key must decode to 32-byte x25519 public key`
- `web_public_key must decode to 32-byte x25519 public key`
- `session_token is required`
- `qr_token is required`

---

## 25. Обязательные правила для frontend

- не хранить `private_key` в `localStorage`
- не хранить master password в `localStorage`
- не угадывать KDF или key format
- не использовать один и тот же private key на mobile и web
- не обещать пользователю old history только на основании одного backup

### Правильная UX формулировка

Если web новый:

- "новые сообщения будут доступны сразу"
- "старая история будет подключена после подтверждения на мобильном устройстве"

---

## 26. Обязательные правила для backend

- валидировать canonical `X25519 public key`
- отдавать deterministic backup contract
- держать docs согласованными
- не смешивать semantics recovery и semantics linked-device onboarding

---

## 27. Acceptance criteria

Считать backend в production-ready состоянии можно если:

- `GET /api/v1/e2ee/backup` отдает полный deterministic contract
- `POST /api/v1/e2ee/keys` валидирует canonical `public_key`
- `POST /api/v1/e2ee/device/register` валидирует canonical `public_key`
- `POST /api/v1/web/pairing/sessions` валидирует canonical `web_public_key`
- docs больше не обещают old history через один только password login
- QR linked-device flow остается canonical путем для old history

---

## 28. Самая короткая версия для команды

Если нужно объяснить совсем коротко:

1. Web это отдельное устройство.
2. У web свой собственный `X25519 key pair`.
3. Backup это recovery material, а не shortcut для old history.
4. Password login дает quick-start для новых сообщений.
5. Старая история для нового web открывается через `QR + history sync / re-wrap`.
