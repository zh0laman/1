# Mobile Linked Devices API Guide

## Назначение

Этот документ нужен mobile-разработчику.

Он описывает, что мобильное приложение должно реализовать со своей стороны для входа в web через QR:

- сканирование QR
- preview устройства перед подтверждением
- approve / reject
- history sync для старых E2EE сообщений
- список linked devices
- logout / revoke web-устройства с телефона

Все примеры ниже соответствуют текущему backend API.

## Общая идея

Mobile приложение уже авторизовано и уже является доверенным устройством пользователя.

Когда пользователь хочет зайти в web:

1. web создаёт pairing session и показывает QR
2. mobile сканирует QR
3. mobile показывает экран подтверждения
4. mobile либо подтверждает устройство, либо отклоняет
5. mobile при необходимости пересылает доступ к старой истории через `history sync`
6. web завершает вход через `redeem`

То есть mobile не логинится заново. Оно подтверждает новый `linked device`.

## Что mobile должен уметь

- открыть экран `Linked devices`
- открыть экран `Scan QR`
- распарсить QR payload
- показать preview:
  - браузер
  - IP
  - страна / город
  - время запроса
- подтвердить или отклонить вход
- при подтверждении сделать history sync для старых E2EE сообщений
- показать список уже подключённых устройств
- уметь сделать logout конкретного web device

## Какие endpoint-ы нужны mobile

Все endpoint-ы ниже требуют авторизацию mobile-пользователя через обычный `Bearer` токен.

- `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/preview`
- `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/approve`
- `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/reject`
- `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/history`
- `GET /api/v1/e2ee/devices`
- `DELETE /api/v1/e2ee/devices/{device_id}`

## Базовый URL

Во всех примерах ниже используется:

```bash
BASE_URL="http://92.38.48.9:18080"
MOBILE_ACCESS_TOKEN="mobile-access-token"
```

---

## 1. Что mobile получает из QR

QR, который показывает web, должен содержать `qr_payload`.

Пример payload:

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

## Что mobile должен проверить сразу после скана

- `type == "web_pairing"`
- `pairing_id` не пустой
- `qr_token` не пустой
- `web_device_id` не пустой
- `web_public_key` не пустой
- `expires_at` ещё не истёк

Если QR пришёл не как raw JSON, а как deep link вроде:

```text
messenger://web-pair?data=<base64url(json)>
```

то mobile должен сначала извлечь `data`, декодировать и получить тот же JSON.

---

## 2. Preview перед подтверждением

После сканирования QR mobile не должен сразу доверять устройству.

Сначала нужно запросить preview, чтобы показать пользователю:

- откуда вход
- какой браузер
- какой IP
- какая страна / город

### Request

```bash
curl -X POST "$BASE_URL/api/v1/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/preview" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "opaque-qr-token"
  }'
```

### Response `200 OK`

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "web_public_key": "base64-x25519-public-key",
  "request_ip": "203.0.113.10",
  "request_country": "KZ",
  "request_city": "Almaty",
  "request_user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136.0 Safari/537.36",
  "expires_at": "2026-03-28T09:30:00Z",
  "status": "pending",
  "created_at": "2026-03-28T09:28:55Z"
}
```

## Что показывать пользователю на экране preview

- название браузера или `request_user_agent`
- IP адрес
- страна / город, если backend их знает
- время создания запроса
- предупреждение вида:
  - `Вы подтверждаете вход в web-версию?`

## Если preview не прошёл

Не нужно делать `approve`.

Нужно показать ошибку:

- QR недействителен
- QR истёк
- pairing session не найдена

---

## 3. Approve входа в web

Если пользователь нажал "Подтвердить", mobile должен отправить `approve`.

### Request

```bash
curl -X POST "$BASE_URL/api/v1/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/approve" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "opaque-qr-token",
    "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
    "web_public_key": "base64-x25519-public-key",
    "device_name": "Chrome on MacBook Pro",
    "platform": "web",
    "history_sync": true
  }'
```

### Response `200 OK`

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

## Что значит approve

После `approve` backend:

- привязывает `web_device_id` к пользователю
- сохраняет `web_public_key`
- помечает устройство как доверенное

## Важный нюанс

Поле `history_sync` сейчас можно передавать как флаг намерения, но само решение о том, делать ли перенос старой истории, остаётся на стороне mobile UX.

То есть:

- если хотите открыть старые сообщения на web, после approve нужно вызвать `history`
- если history sync пока не делаете, web всё равно сможет работать с новыми сообщениями после linking

---

## 4. Reject входа в web

Если пользователь нажал "Отклонить", mobile должен отправить `reject`.

### Request

```bash
curl -X POST "$BASE_URL/api/v1/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/reject" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "opaque-qr-token"
  }'
```

### Response `200 OK`

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

## Что делать после reject

- показать пользователю `Вход отклонён`
- не выполнять history sync
- не добавлять локально устройство в trusted list вручную

---

## 5. History Sync для старых E2EE сообщений

Если вы хотите, чтобы web сразу открыл старые сообщения, mobile после `approve` должен отправить re-wrapped message keys.

## Что mobile делает локально

Для каждого старого сообщения:

1. mobile находит `message key`
2. расшифровывает его своим текущим доверенным ключом
3. шифрует этот же `message key` на `web_public_key`
4. отправляет `encrypted_key_for_web` на backend

Backend при этом:

- не видит plaintext
- не меняет ciphertext сообщения
- просто дописывает новый wrapped key в `messages.encrypted_keys`

## Request

```bash
curl -X POST "$BASE_URL/api/v1/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/history" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
    "items": [
      {
        "message_id": "2f9f5e4d-c425-4cff-bf44-2f7cfc52a8df",
        "encrypted_key_for_web": "base64-wrapped-message-key-1"
      },
      {
        "message_id": "948758b9-1b79-4d24-8df2-4e90eb6ba57c",
        "encrypted_key_for_web": "base64-wrapped-message-key-2"
      }
    ]
  }'
```

### Response `200 OK`

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "status": "synced",
  "synced_count": 2,
  "synced_at": "2026-03-28T09:29:25Z"
}
```

## Практические рекомендации для mobile

- отправлять history sync батчами
- не грузить всю историю одним запросом
- начать с последних сообщений
- сначала синхронизировать активные чаты
- при очень большой истории делать прогресс:
  - `Синхронизировано 120 из 1000`

## Рекомендуемый размер batch

Практично начать с:

- `50`
- `100`
- `200`

сообщений на запрос

## Если history sync не удался частично

Можно:

- повторить батч
- пропустить невалидные сообщения
- синхронизировать только последние чаты в MVP

---

## 6. Получить список связанных устройств

Mobile должен уметь показать экран `Linked devices`.

### Request

```bash
curl "$BASE_URL/api/v1/e2ee/devices" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN"
```

### Response `200 OK`

```json
{
  "devices": [
    {
      "user_id": 42,
      "device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
      "public_key": "base64-x25519-public-key",
      "device_name": "Chrome on MacBook Pro",
      "platform": "web",
      "status": "trusted",
      "trusted_at": "2026-03-28T09:29:10Z",
      "last_seen_at": "2026-03-28T09:29:40Z",
      "last_login_at": "2026-03-28T09:29:40Z",
      "linked_ip": "203.0.113.10",
      "linked_country": "KZ",
      "linked_city": "Almaty",
      "last_ip": "203.0.113.10",
      "last_country": "KZ",
      "last_city": "Almaty",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136.0 Safari/537.36",
      "created_at": "2026-03-28T09:28:55Z"
    },
    {
      "user_id": 42,
      "device_id": "mobile-device-1",
      "public_key": "base64-mobile-key",
      "device_name": "iPhone 15 Pro",
      "platform": "ios",
      "status": "trusted",
      "trusted_at": "2026-03-01T11:00:00Z",
      "last_seen_at": "2026-03-28T09:25:00Z",
      "last_login_at": "2026-03-28T09:25:00Z",
      "created_at": "2026-03-01T11:00:00Z"
    }
  ],
  "count": 2
}
```

## Что показывать в UI списка устройств

- `device_name`
- `platform`
- `status`
- `trusted_at`
- `last_seen_at`
- `last_login_at`
- `linked_ip`
- `linked_country`
- `linked_city`
- `user_agent`

## Рекомендуемый UX

Для каждого web device показывать:

- название браузера
- город / страну
- время последней активности
- кнопку `Выйти с этого устройства`

---

## 7. Logout web device с телефона

Если пользователь хочет принудительно завершить сессию web, mobile должен вызвать revoke.

### Request

```bash
curl -X DELETE "$BASE_URL/api/v1/e2ee/devices/8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN"
```

### Response `200 OK`

```json
{
  "message": "linked device revoked"
}
```

## Что происходит после revoke

Backend:

- помечает устройство как `revoked`
- отзывает связанные локальные web session токены пользователя

Mobile UI после этого должен:

- удалить устройство из активного списка
- либо пометить его как `revoked`
- показать пользователю сообщение:
  - `Устройство отключено`

---

## 8. Типовой полный flow для mobile

### Шаг 1. Пользователь нажал `Сканировать QR`

Mobile открывает in-app scanner.

### Шаг 2. Scanner считал QR

Mobile получает payload:

```json
{
  "type": "web_pairing",
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "qr_token": "opaque-qr-token",
  "web_device_id": "8aefdb5f-1a1a-4316-a8fa-9067fd3eb0c7",
  "web_public_key": "base64-x25519-public-key",
  "expires_at": "2026-03-28T09:30:00Z"
}
```

### Шаг 3. Mobile вызывает preview

```bash
curl -X POST "$BASE_URL/api/v1/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/preview" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qr_token":"opaque-qr-token"}'
```

### Шаг 4. Mobile показывает экран подтверждения

Например:

- `Chrome on MacBook`
- `Almaty, KZ`
- `203.0.113.10`
- `Запрос создан 10 секунд назад`

### Шаг 5A. Пользователь нажал `Отклонить`

Mobile вызывает `reject`.

### Шаг 5B. Пользователь нажал `Подтвердить`

Mobile вызывает `approve`.

### Шаг 6. Mobile делает history sync

Если нужен доступ к старым сообщениям на web, mobile батчами вызывает `history`.

### Шаг 7. Mobile обновляет экран linked devices

После успешного approve или revoke mobile может заново вызвать:

```bash
curl "$BASE_URL/api/v1/e2ee/devices" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN"
```

---

## 9. Типовой error response

Backend возвращает ошибки в таком формате:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "qr_token is required",
    "details": {}
  }
}
```

Типовые статусы:

- `400` — плохой QR, mismatch device key, pairing истёк
- `401` — mobile пользователь не авторизован
- `403` — попытка трогать чужую pairing session
- `404` — pairing session или device не найдены
- `500` — внутренняя ошибка backend

---

## 10. Какие ошибки mobile должен обрабатывать

- QR невалиден
- QR истёк
- QR уже использован
- web device mismatch
- web public key mismatch
- сеть недоступна
- history sync завершился не полностью
- устройство уже revoked

---

## 11. Что mobile не должен делать

- не должен хранить `session_token` web-клиента
- не должен получать private key web-клиента
- не должен отправлять на backend plaintext сообщений
- не должен слать на backend нерасшифрованную историю как есть без re-wrap
- не должен доверять QR без preview/approve flow

---

## 12. Рекомендуемые экраны в mobile app

- `Linked devices list`
- `Scan QR`
- `Approve web login`
- `Syncing history`
- `Device details`

## Для экрана Approve web login показывать

- browser / user-agent
- city / country
- IP
- created_at
- кнопки:
  - `Confirm`
  - `Reject`

## Для экрана Linked devices list показывать

- `device_name`
- `platform`
- `last_seen_at`
- `last_login_at`
- `location`
- `status`
- action `Log out this device`

---

## 13. Короткий алгоритм для mobile

1. Пользователь открывает `Linked devices`.
2. Нажимает `Scan QR`.
3. Mobile сканирует QR.
4. Mobile валидирует payload.
5. Mobile вызывает `preview`.
6. Показывает экран подтверждения.
7. Если reject:
   - вызывает `reject`
8. Если approve:
   - вызывает `approve`
   - затем батчами вызывает `history`
9. После завершения обновляет список устройств через `GET /api/v1/e2ee/devices`.
10. Если пользователь хочет завершить web session позже:
   - вызывает `DELETE /api/v1/e2ee/devices/{device_id}`

---

## 14. Связанные документы

- [Frontend QR Login Flow Guide](/Users/askar.abylkhaiyrov.00gmail.com/Desktop/backend/go/alem-super-app-backend/docs/frontend_web_qr_login_guide.md)
- [E2EE Web Pairing Frontend Contract](/Users/askar.abylkhaiyrov.00gmail.com/Desktop/backend/go/alem-super-app-backend/docs/e2ee_web_pairing_contract.md)
