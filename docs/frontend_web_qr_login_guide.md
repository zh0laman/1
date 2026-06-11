# Frontend QR Login Flow Guide

## Назначение

Этот документ нужен frontend-разработчику web-клиента.

Здесь описан полный flow входа через QR:

- web создаёт pairing session
- web рисует QR
- mobile сканирует QR и подтверждает вход
- web ждёт approve/sync
- web завершает вход через `redeem`

Документ соответствует текущему backend API.

## Ключевая идея

Пользователь не логинится на сайте паролем.

Вместо этого:

1. сайт создаёт новый `web device`
2. сайт показывает QR
3. пользователь сканирует QR в уже авторизованном мобильном приложении
4. mobile подтверждает вход
5. backend выпускает web session

Это не просто "QR login". Это `linked device login`.

## Кто что делает

### Web frontend делает

- генерирует `web_device_id`
- генерирует E2EE key pair
- хранит private key локально в `IndexedDB`
- вызывает публичные pairing endpoint-ы
- рисует QR из `qr_payload`
- поллит статус pairing session
- вызывает `redeem`
- после `redeem` работает как обычный авторизованный web-клиент

### Mobile приложение делает

- сканирует QR
- показывает preview устройства
- вызывает `approve` или `reject`
- если включён history sync, re-wrap старые message keys для нового `web_device_id`

### Backend делает

- создаёт pairing session
- проверяет QR token и session token
- после mobile approve связывает `web_device_id` с пользователем
- после `redeem` выдаёт web auth tokens и cookie

## Важные правила безопасности

- в QR кодируется только `qr_payload`
- `session_token` нельзя класть в QR
- `session_token` должен жить только в памяти web-клиента
- private key нельзя хранить в `localStorage`
- private key нужно хранить в `IndexedDB`
- QR должен считаться одноразовым и короткоживущим

## Базовый state machine для frontend

- `idle`
- `creating_pairing`
- `qr_ready`
- `waiting_for_mobile`
- `approved`
- `synced`
- `redeeming`
- `authenticated`
- `expired`
- `revoked`
- `error`

## Базовый URL

Во всех примерах ниже используется:

```bash
BASE_URL="http://92.38.48.9:18080"
```

Все endpoint-ы ниже идут под префиксом `/api/v1`.

---

## 1. Создать pairing session

Web frontend должен сначала локально сгенерировать:

- `web_device_id`
- `web_public_key`
- опционально `web_ephemeral_pub`

### Request

```bash
curl -X POST "$BASE_URL/api/v1/web/pairing/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
    "web_public_key": "base64-x25519-public-key",
    "web_ephemeral_pub": "base64-optional-ephemeral-key",
    "ttl_seconds": 90
  }'
```

### Response `201 Created`

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "qr_token": "opaque-qr-token",
  "session_token": "opaque-session-token",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "web_public_key": "base64-x25519-public-key",
  "web_ephemeral_pub": "base64-optional-ephemeral-key",
  "status": "pending",
  "expires_at": "2026-03-28T09:30:00Z",
  "qr_payload": {
    "type": "web_pairing",
    "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
    "qr_token": "opaque-qr-token",
    "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
    "web_public_key": "base64-x25519-public-key",
    "web_ephemeral_pub": "base64-optional-ephemeral-key",
    "expires_at": "2026-03-28T09:30:00Z"
  }
}
```

### Что делать frontend после ответа

- сохранить `pairing_id`
- сохранить `session_token` только локально
- сохранить `expires_at`
- взять `qr_payload`
- превратить `qr_payload` в строку
- показать строку как QR-код
- запустить polling статуса pairing session

### Что кодировать в QR

Рекомендуемый вариант:

```json
{
  "type": "web_pairing",
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "qr_token": "opaque-qr-token",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "web_public_key": "base64-x25519-public-key",
  "web_ephemeral_pub": "base64-optional-ephemeral-key",
  "expires_at": "2026-03-28T09:30:00Z"
}
```

То есть frontend должен рендерить QR из:

```js
JSON.stringify(response.qr_payload)
```

Можно и в более удобной строковой форме:

```text
messenger://web-pair?data=<base64url(json(qr_payload))>
```

Но backend сейчас уже возвращает готовый `qr_payload`, и этого достаточно.

---

## 2. Рисовать QR на frontend

Backend не обязан генерировать PNG/SVG QR.

Правильнее и проще:

- backend отдаёт только `qr_payload`
- frontend рисует QR любой библиотекой

Например:

```ts
const qrValue = JSON.stringify(createPairingResponse.qr_payload)
```

И потом передаёт `qrValue` в библиотеку типа:

- `qrcode`
- `react-qr-code`
- `qrcode.react`

---

## 3. Poll статуса pairing session

После показа QR web должен начать polling.

### Request

```bash
curl "$BASE_URL/api/v1/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f?session_token=opaque-session-token"
```

Или через header:

```bash
curl "$BASE_URL/api/v1/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f" \
  -H "X-Session-Token: opaque-session-token"
```

### Response пока QR ещё не подтверждён

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "status": "pending",
  "approved": false,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-03-28T09:30:00Z"
}
```

### Response после approve от mobile

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "status": "approved",
  "approved": true,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-03-28T09:30:00Z",
  "approved_at": "2026-03-28T09:29:10Z"
}
```

### Response после history sync

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "status": "synced",
  "approved": true,
  "synced": true,
  "redeemed": false,
  "expires_at": "2026-03-28T09:30:00Z",
  "approved_at": "2026-03-28T09:29:10Z",
  "synced_at": "2026-03-28T09:29:25Z"
}
```

### Response если QR отклонён на mobile

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "status": "revoked",
  "approved": false,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-03-28T09:30:00Z"
}
```

### Response если QR истёк

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "status": "expired",
  "approved": false,
  "synced": false,
  "redeemed": false,
  "expires_at": "2026-03-28T09:30:00Z"
}
```

### Что делать frontend по статусам

- `pending`: продолжать polling
- `approved`: можно показать "Устройство подтверждено, ждём синхронизацию истории"
- `synced`: можно сразу делать `redeem`
- `approved` без `synced`: допустимо дать вход и позже догрузить историю, если ваш UX это позволяет
- `revoked`: остановить polling и показать "Вход отклонён"
- `expired`: остановить polling и показать кнопку "Обновить QR"
- `redeemed`: остановить polling, пользователь уже залогинен

### Рекомендации по polling

- интервал: каждые `2-3 секунды`
- таймаут одной попытки: `5-10 секунд`
- переставать poll после `redeemed`, `revoked`, `expired`

---

## 4. Завершить вход через redeem

Когда mobile подтвердил вход, web должен вызвать `redeem`.

### Request

```bash
curl -X POST "$BASE_URL/api/v1/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "opaque-session-token"
  }'
```

### Response `200 OK`

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "token_type": "Bearer",
  "expires_in": 86400,
  "expires_at": "2026-03-29T09:29:40Z"
}
```

### Что делает backend дополнительно

Backend также ставит cookie:

- `access_token`
- `refresh_token`

Cookie ставятся как `httpOnly`.

### Что делать frontend после redeem

- считать пользователя авторизованным
- сохранить `web_device_id` и локальный private key
- если используете cookie auth, дальше работать обычными `fetch(..., { credentials: "include" })`
- если используете bearer auth, можно брать `access_token` из ответа
- сразу вызвать `/api/v1/auth/me`, чтобы получить профиль пользователя

---

## 5. Получить текущего пользователя после входа

После `redeem` frontend обычно проверяет сессию через существующий auth endpoint.

### Request

Через cookie:

```bash
curl "$BASE_URL/api/v1/auth/me" \
  --cookie "access_token=jwt-access-token"
```

Или через header:

```bash
curl "$BASE_URL/api/v1/auth/me" \
  -H "Authorization: Bearer jwt-access-token"
```

### Ожидаемый результат

- `200 OK`
- JSON профиля текущего пользователя

После этого frontend может открывать:

- список чатов
- websocket
- загрузку истории
- E2EE bootstrap для web device

---

## 6. Обновление access token

Если web работает на bearer token, используйте стандартный refresh endpoint.

### Request

```bash
curl -X POST "$BASE_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "jwt-refresh-token"
  }'
```

### Response

```json
{
  "access_token": "new-jwt-access-token",
  "refresh_token": "new-jwt-refresh-token",
  "token_type": "Bearer",
  "expires_in": 86400,
  "expires_at": "2026-03-29T10:00:00Z"
}
```

Если работаете только на cookie, refresh можно тоже оставлять cookie-driven.

---

## 7. Logout на web

После входа web использует обычный auth logout.

### Request

```bash
curl -X POST "$BASE_URL/api/v1/auth/logout" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "jwt-refresh-token"
  }'
```

### Response

```json
{
  "message": "logged out successfully"
}
```

---

## 8. Что web frontend не делает

Web frontend не делает:

- `preview`
- `approve`
- `reject`
- `history sync`

Это делает мобильное приложение.

То есть web должен только:

- создать pairing session
- показать QR
- ждать статуса
- сделать redeem

---

## 9. Полный end-to-end пример

### Шаг 1. Web создаёт pairing session

```bash
curl -X POST "$BASE_URL/api/v1/web/pairing/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
    "web_public_key": "base64-x25519-public-key",
    "ttl_seconds": 90
  }'
```

Frontend получает:

- `pairing_id`
- `session_token`
- `qr_payload`

### Шаг 2. Web рисует QR

```js
const qrValue = JSON.stringify(response.qr_payload)
```

### Шаг 3. Mobile сканирует QR и подтверждает вход

Это делает mobile app.

После этого web видит в poll один из статусов:

- `approved`
- `synced`
- `revoked`
- `expired`

### Шаг 4. Web поллит статус

```bash
curl "$BASE_URL/api/v1/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f?session_token=opaque-session-token"
```

### Шаг 5. Когда статус `approved` или `synced`, web делает redeem

```bash
curl -X POST "$BASE_URL/api/v1/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "opaque-session-token"
  }'
```

### Шаг 6. После redeem web считается залогиненным

Дальше используйте обычные защищённые endpoint-ы backend.

---

## 10. Типовой error response

Backend возвращает ошибки в таком формате:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "session_token is required",
    "details": {}
  }
}
```

Типовые коды:

- `400` `VALIDATION_ERROR` или `BAD_REQUEST`
- `401` `UNAUTHORIZED`
- `403` `FORBIDDEN`
- `404` `NOT_FOUND`
- `429` `TOO_MANY_REQUESTS`
- `500` `INTERNAL_ERROR`

---

## 11. Какие статусы нужно поддержать в UI

- `QR готов`
- `Ожидаем подтверждения на телефоне`
- `Устройство подтверждено`
- `Синхронизируем историю`
- `Вход выполнен`
- `QR истёк`
- `Вход отклонён`
- `Ошибка, попробуйте снова`

---

## 12. Рекомендуемый алгоритм на frontend

1. При открытии страницы логина проверить, есть ли уже валидная web session.
2. Если сессии нет, сгенерировать `web_device_id` и E2EE key pair.
3. Сохранить private key в `IndexedDB`.
4. Вызвать `POST /api/v1/web/pairing/sessions`.
5. Нарисовать QR из `qr_payload`.
6. Запустить polling `GET /api/v1/web/pairing/sessions/{pairing_id}`.
7. Если статус `expired`, пересоздать pairing session и новый QR.
8. Если статус `revoked`, показать ошибку и кнопку "Попробовать ещё раз".
9. Если статус `approved` или `synced`, вызвать `redeem`.
10. После `redeem` открыть обычное приложение.

---

## 13. Что лучше не делать

- не генерировать QR как отдельный backend PNG endpoint без необходимости
- не класть `session_token` в QR
- не хранить private key в `localStorage`
- не считать web просто "браузером без device identity"
- не ждать от Keycloak, что он решит E2EE linking сам по себе

---

## 14. Связанные документы

- [E2EE Web Pairing Frontend Contract](/Users/askar.abylkhaiyrov.00gmail.com/Desktop/backend/go/alem-super-app-backend/docs/e2ee_web_pairing_contract.md)
- [Mobile Linked Devices API Guide](/Users/askar.abylkhaiyrov.00gmail.com/Desktop/backend/go/alem-super-app-backend/docs/mobile_linked_devices_api_guide.md)
