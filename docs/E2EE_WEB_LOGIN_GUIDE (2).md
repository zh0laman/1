# Web Frontend Guide: Login + E2EE Bootstrap

Актуально для текущего backend flow на `2026-04-05`.

## Base URL

```bash
BASE_URL="http://92.38.48.9:18080/api/v1"
WS_URL="ws://92.38.48.9:18080/api/v1/ws"
```

## Что frontend должен понимать сразу

Для web UI здесь есть 2 разных сценария:

1. `Быстрый старт`
   Новый браузер получает свой новый E2EE key pair и сразу начинает читать/отправлять новые сообщения.

2. `Полное восстановление`
   Если нужно расшифровать старую E2EE-историю через cloud backup, frontend должен получить `backup`, попросить у пользователя E2EE master password и расшифровать ключ локально в браузере.

Важно:

- `POST /auth/login` только логинит пользователя.
- `POST /e2ee/device/register` обязательно должен вызываться после web login.
- Именно `POST /e2ee/device/register`:
  - привязывает текущий браузер как linked web device
  - сохраняет `ip / country / city / user-agent`
  - может автоматически завершить другие web browser sessions
  - возвращает device-scoped web tokens
  - может сразу вернуть `backup`

Еще важно:

- если нужен полностью passwordless доступ к старой истории, текущий password-login flow этого не делает
- для passwordless history restore нужен QR linked-device flow
- текущий password-login flow честно поддерживает cloud backup, но backup шифруется на клиенте и без master password сервер его не расшифрует

---

## Полный flow для frontend

### Шаг 1. Логин по email/password

#### Request

```bash
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "StrongPassword123"
  }'
```

#### Response `200 OK`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bootstrap-access",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bootstrap-refresh",
  "token_type": "bearer",
  "expires_in": 300,
  "expires_at": "2026-04-05T12:05:00Z"
}
```

Что делает frontend:

- сохраняет эти токены временно
- НЕ считает этот шаг завершением web bootstrap
- сразу переходит к подготовке web device

Примечание:

- текущий `/auth/login` не возвращает профиль пользователя
- если нужен профиль сразу, вызовите `/auth/me`

#### Optional: текущий пользователь

```bash
curl "$BASE_URL/auth/me" \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_LOGIN>"
```

---

### Шаг 2. Выбрать один из двух frontend сценариев

#### Вариант A. Быстрый старт

Используется если:

- это новый браузер
- старая история не обязательна прямо сейчас
- нужен быстрый вход и работа с новыми сообщениями

Тогда frontend:

- создает стабильный `device_id`
- генерирует новый локальный key pair
- вызывает `/e2ee/device/register`

#### Вариант B. Полное восстановление истории

Используется если:

- пользователь хочет читать старую E2EE-историю
- у него уже есть `key backup`
- он готов ввести master password в web UI

Тогда frontend:

1. запрашивает `/e2ee/backup`
2. локально расшифровывает backup через master password
3. получает private key
4. вычисляет соответствующий public key
5. вызывает `/e2ee/device/register` уже с этим `public_key`

---

## Вариант A. Быстрый старт

### Шаг 3A. Сгенерировать `device_id` и E2EE key pair

Frontend должен хранить:

- `device_id` стабильно для этого browser slot
- private key только локально
- public key для отправки на backend

Рекомендуемое поведение:

- `device_id` хранить в `localStorage` или `IndexedDB`
- private key хранить в `IndexedDB`
- не хранить private key в `localStorage`

Пример логики:

```ts
function getOrCreateWebDeviceId(): string {
  const key = "web_e2ee_device_id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}
```

---

### Шаг 4A. Зарегистрировать текущий браузер как linked web device

Это главный endpoint для web bootstrap.

#### Request

```bash
curl -i -X POST "$BASE_URL/e2ee/device/register" \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_LOGIN>" \
  -H "Content-Type: application/json" \
  -H "X-Web-Device-ID: 7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f" \
  -d '{
    "device_id": "7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f",
    "public_key": "BASE64_PUBLIC_KEY_FROM_BROWSER",
    "device_name": "Chrome on macOS",
    "platform": "web",
    "replace_other_web_sessions": true,
    "include_backup": true
  }'
```

#### Response `200 OK`

```json
{
  "device_id": "7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f",
  "message": "device registered successfully",
  "has_backup": true,
  "backup_algo": "argon2id",
  "backup": {
    "user_id": 42,
    "encrypted_private_key": "BASE64_BACKUP_CIPHERTEXT",
    "salt": "BASE64_SALT",
    "iv": "BASE64_IV",
    "kdf_algorithm": "argon2id",
    "version": 1,
    "created_at": "2026-03-20T10:00:00Z",
    "updated_at": "2026-04-01T09:15:00Z"
  },
  "user": {
    "id": 42,
    "email": "user@example.com",
    "username": "askar",
    "first_name": "Askar",
    "last_name": "Abylkhaiyrov"
  },
  "current_login": {
    "ip": "92.38.48.9",
    "country": "KZ",
    "city": "Almaty",
    "user_agent": "Mozilla/5.0 ..."
  },
  "revoked_device_ids": [
    "old-web-device-1",
    "old-web-device-2"
  ],
  "replace_other_web_sessions": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.linked-device-access",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.linked-device-refresh",
  "token_type": "Bearer",
  "expires_in": 300,
  "expires_at": "2026-04-05T12:10:00Z"
}
```

Backend также ставит cookies:

- `Set-Cookie: access_token=...`
- `Set-Cookie: refresh_token=...`

Что frontend обязан сделать после ответа:

1. заменить bootstrap tokens из `/auth/login` на токены из `/e2ee/device/register`
2. считать именно этот ответ финальным web session bootstrap
3. сохранить `device_id`
4. если `revoked_device_ids` не пустой:
   показать пользователю, что старые браузеры завершены
5. использовать `current_login` для security UI
6. если `has_backup=true`:
   можно предложить пользователю восстановить старую историю через master password

Что делает backend при `replace_other_web_sessions=true`:

- отзывает другие `web` устройства пользователя
- отзывает их linked web JWT sessions
- создает security notification о новом web login

Поведение старого браузера:

- следующие HTTP запросы начнут получать `401`
- websocket после реконнекта тоже не пройдет авторизацию
- frontend старого браузера должен отправить пользователя на экран логина

---

### Шаг 5A. Подключить websocket уже новым linked-device token

Рекомендуемый вариант:

```text
ws://92.38.48.9:18080/api/v1/ws?token=<ACCESS_TOKEN_FROM_DEVICE_REGISTER>&web_device_id=<DEVICE_ID>
```

Пример:

```bash
echo 'ws://92.38.48.9:18080/api/v1/ws?token=<TOKEN>&web_device_id=7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f'
```

Рекомендация для frontend:

- во все websocket reconnection attempts передавать актуальный `access_token`
- передавать `web_device_id`
- на `401` или failed reconnect очищать локальную сессию и переводить пользователя на login screen

---

### Шаг 6A. Создать или получить личный диалог

#### Request

```bash
curl -X POST "$BASE_URL/conversations" \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_DEVICE_REGISTER>" \
  -H "Content-Type: application/json" \
  -H "X-Web-Device-ID: 7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f" \
  -d '{
    "peer_id": 45
  }'
```

#### Response `200 OK`

```json
{
  "id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "type": "personal",
  "created_by": 42,
  "created_at": "2026-04-05T12:00:00Z",
  "updated_at": "2026-04-05T12:00:00Z"
}
```

---

### Шаг 7A. Получить public keys собеседника и свои

Frontend обычно делает 2 запроса:

1. `GET /e2ee/keys/<peer_id>`
2. `GET /e2ee/keys/<my_user_id>`

#### Request

```bash
curl "$BASE_URL/e2ee/keys/45" \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_DEVICE_REGISTER>"
```

#### Response `200 OK`

```json
{
  "user_id": 45,
  "keys": {
    "mobile-device-1": "BASE64_PUBLIC_KEY_A",
    "web-device-1": "BASE64_PUBLIC_KEY_B"
  }
}
```

Что делает frontend:

- генерирует случайный message key
- шифрует plaintext сообщения в `content`
- делает per-device wrapping этого message key
- кладет wrapped keys в `keys`

---

### Шаг 8A. Отправить E2EE сообщение

#### Request

```bash
curl -X POST "$BASE_URL/conversations/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5/messages" \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_DEVICE_REGISTER>" \
  -H "Content-Type: application/json" \
  -H "X-Web-Device-ID: 7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f" \
  -d '{
    "content": "{\"v\":1,\"alg\":\"aes-256-gcm\",\"iv\":\"BASE64_IV\",\"ciphertext\":\"BASE64_CIPHERTEXT\"}",
    "content_hash": "sha256-of-plaintext-or-empty",
    "keys": {
      "mobile-device-1": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"ciphertext\":\"...\"}",
      "web-device-1": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"ciphertext\":\"...\"}",
      "7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"ciphertext\":\"...\"}"
    },
    "type": "text"
  }'
```

#### Response `201 Created`

```json
{
  "id": "e5f847b7-9e8d-4b0d-8be6-3c0c9e2ce500",
  "conversation_id": "8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5",
  "sender_id": 42,
  "content": "{\"v\":1,\"alg\":\"aes-256-gcm\",\"iv\":\"BASE64_IV\",\"ciphertext\":\"BASE64_CIPHERTEXT\"}",
  "content_hash": "sha256-of-plaintext-or-empty",
  "encrypted_keys": {
    "mobile-device-1": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"ciphertext\":\"...\"}",
    "web-device-1": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"ciphertext\":\"...\"}",
    "7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"ciphertext\":\"...\"}"
  },
  "type": "text",
  "is_deleted": false,
  "created_at": "2026-04-05T12:02:00Z",
  "updated_at": "2026-04-05T12:02:00Z"
}
```

---

### Шаг 9A. Получить сообщения и расшифровать их на web

#### Request

```bash
curl "$BASE_URL/conversations/8fd6f0df-fc80-49ae-9ebd-2e0a3238f1f5/messages?limit=50&offset=0" \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_DEVICE_REGISTER>" \
  -H "X-Web-Device-ID: 7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f"
```

#### Что делает frontend для каждого сообщения

1. берет `encrypted_keys[current_device_id]`
2. расшифровывает wrapped message key своим private key
3. этим message key расшифровывает `content`
4. показывает plaintext

Если `encrypted_keys[current_device_id]` нет:

- это сообщение не было зашифровано для текущего web device
- для нового браузера это нормально для старой истории
- для старой истории нужен restore flow или QR history sync flow

---

## Вариант B. Полное восстановление старой истории

### Шаг 3B. Получить cloud backup

#### Request

```bash
curl "$BASE_URL/e2ee/backup" \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_LOGIN>"
```

#### Response `200 OK`

```json
{
  "user_id": 42,
  "encrypted_private_key": "BASE64_BACKUP_CIPHERTEXT",
  "salt": "BASE64_SALT",
  "iv": "BASE64_IV",
  "kdf_algorithm": "argon2id",
  "version": 1,
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-04-01T09:15:00Z"
}
```

#### Response `204 No Content`

Это значит:

- backup еще не создан
- полный restore невозможен
- нужно перейти на Вариант A

---

### Шаг 4B. Попросить у пользователя master password и локально расшифровать backup

Это делается только на frontend.

Backend здесь не участвует.

Frontend делает:

1. принимает пароль в UI
2. через `salt + iv + kdf_algorithm` выводит ключ
3. расшифровывает `encrypted_private_key`
4. импортирует private key в WebCrypto
5. экспортирует соответствующий public key

После этого frontend уже знает:

- `privateKey`
- `publicKey`

И только потом вызывает `/e2ee/device/register`.

---

### Шаг 5B. Зарегистрировать устройство с public key от восстановленного private key

#### Request

```bash
curl -X POST "$BASE_URL/e2ee/device/register" \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_LOGIN>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "7df0f53b-1d8c-4f53-b1b2-1a2b3c4d5e6f",
    "public_key": "BASE64_PUBLIC_KEY_DERIVED_FROM_RESTORED_PRIVATE_KEY",
    "device_name": "Chrome on macOS",
    "platform": "web",
    "replace_other_web_sessions": true,
    "include_backup": true
  }'
```

Дальше flow совпадает с Вариантом A:

- заменить токены на response tokens
- подключить websocket
- получить сообщения
- расшифровывать историю

---

## Что делать frontend с `revoked_device_ids`

Если backend вернул:

```json
{
  "revoked_device_ids": [
    "old-web-device-1",
    "old-web-device-2"
  ]
}
```

то UI может показать:

- `Мы завершили предыдущие web-сессии для вашей безопасности`

Если пользователь НЕ хочет отключать старые браузеры:

```json
{
  "replace_other_web_sessions": false
}
```

Но для security policy web UI лучше оставлять `true`.

---

## Ошибки, которые frontend должен обрабатывать

### `POST /auth/login`

`401 Unauthorized`

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "invalid credentials"
  }
}
```

Действие frontend:

- показать ошибку логина
- не переходить к E2EE bootstrap

### `POST /e2ee/device/register`

`400 Bad Request`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid request body"
  }
}
```

или

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "public_key is required"
  }
}
```

Действие frontend:

- проверить `device_id`
- проверить `public_key`
- повторить bootstrap

### Любой защищенный endpoint после device rotation

`401 Unauthorized`

Это типичный случай для старого браузера, который уже вытеснен новым.

Действие frontend:

1. очистить локальную web session
2. закрыть websocket
3. показать экран `Session expired`
4. перевести пользователя на login

---

## Рекомендуемый порядок хранения на frontend

### Можно хранить

- `device_id` в `localStorage` или `IndexedDB`
- `publicKey` в `IndexedDB`
- `privateKey` в `IndexedDB`
- linked web tokens в memory storage или secure cookie flow

### Нельзя хранить

- master password в `localStorage`
- расшифрованный backup blob в `localStorage`

---

## Минимальный production-ready bootstrap sequence

1. `POST /auth/login`
2. `getOrCreateWebDeviceId()`
3. если нужен full restore:
   `GET /e2ee/backup`
4. получить `public_key`
   либо из нового key pair
   либо из restored private key
5. `POST /e2ee/device/register`
6. заменить bootstrap tokens на returned linked-device tokens
7. подключить websocket через `/ws?token=...&web_device_id=...`
8. загрузить `/auth/me`
9. загрузить `/conversations`
10. при открытии чата:
    - `GET /e2ee/keys/<peer_id>`
    - `GET /e2ee/keys/<my_user_id>`
    - `GET /conversations/{conversation_id}/messages`
11. отправлять ciphertext через `POST /conversations/{conversation_id}/messages`

---

## Короткий вывод для frontend команды

- `/auth/login` это только вход пользователя
- `/e2ee/device/register` это обязательный web E2EE bootstrap
- canonical web session tokens нужно брать именно из `/e2ee/device/register`
- если `replace_other_web_sessions=true`, новый браузер автоматически вытесняет старые
- если нужен доступ к старой E2EE-истории через backup, frontend должен локально расшифровать backup по master password
- если нужен полностью passwordless history restore, используйте QR linked-device flow, а не password login flow
