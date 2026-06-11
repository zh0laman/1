# E2EE Client Guide For Mobile And Web

## Назначение

Этот документ нужен mobile и web frontend командам.

Он описывает:

- как клиентам вести E2EE одинаково
- какие ключи генерировать
- какие endpoint-ы backend использовать
- как шифровать новое сообщение
- как расшифровывать сообщения
- как web получает доступ к старой истории через linked device flow

Документ соответствует текущему backend API.

## Что backend делает и чего backend не делает

Backend:

- хранит `public_key` устройств
- хранит ciphertext сообщения в `content`
- хранит per-device wrapped message keys в `encrypted_keys`
- отдаёт сообщения и ключи через API / websocket
- не знает plaintext сообщений

Backend не делает:

- не генерирует private key клиента
- не шифрует plaintext за клиента
- не расшифровывает E2EE сообщение
- не навязывает жёстко конкретный crypto-algorithm

Поэтому mobile и web должны реализовать один и тот же client-side crypto profile.

## Что уже есть в текущем backend

### Личные чаты

Для personal chat backend уже явно поддерживает multi-device E2EE:

- `POST /api/v1/e2ee/keys`
- `GET /api/v1/e2ee/keys/{user_id}`
- `POST /api/v1/conversations/{conversation_id}/messages`
- `GET /api/v1/conversations/{conversation_id}/messages`

У сообщения уже есть:

- `content`
- `content_hash`
- `encrypted_keys`

### Linked web device

Для web linked device уже есть:

- QR pairing
- approve / reject
- history sync
- redeem

То есть web можно подключать как отдельное доверенное устройство.

### Key backup

Также уже есть:

- `POST /api/v1/e2ee/backup`
- `GET /api/v1/e2ee/backup`
- `DELETE /api/v1/e2ee/backup`

Это полезно для mobile device recovery.

## Важное ограничение текущего API

Для личных чатов E2EE flow выражен явно через поле `keys` в `SendMessageRequest`.

Для групп текущий `GroupSendMessageRequest` такого поля сейчас не содержит. Значит:

- для personal chat E2EE flow можно реализовывать прямо сейчас
- для group E2EE нужен отдельный согласованный протокол
- лучший следующий шаг для групп — `sender keys` или отдельное поле `keys`

Ниже документ описывает гарантированно рабочий путь для:

- personal chats
- linked web device

---

## Рекомендуемый client crypto profile

Backend не навязывает алгоритм, но чтобы mobile и web были совместимы, им нужно использовать один и тот же crypto profile.

Практичный вариант для ваших клиентов:

- `device identity key`: `X25519`
- `message key`: случайные `32 bytes`
- `message content encryption`: `AES-256-GCM`
- `wrapped message key`: `HPKE / sealed box / X25519 + HKDF + AES-GCM`
- всё сериализуется в `base64`

### Почему такой профиль удобен

- `X25519` удобно поддерживается на mobile
- `AES-GCM` хорошо доступен через `WebCrypto` на web
- per-device wrapped keys удобно класть в `encrypted_keys`

## Что обязательно стандартизовать между mobile и web

Обе команды должны договориться о точном формате:

- как кодируется публичный ключ
- как кодируется приватный ключ
- как выглядит ciphertext для `content`
- как выглядит wrapped key для `encrypted_keys[device_id]`
- как кодируется nonce / IV
- как кодируется auth tag

### Рекомендуемый JSON envelope для `content`

Так как поле `content` — это строка, удобно хранить в нём base64 от JSON envelope или compact JSON string.

Например:

```json
{
  "v": 1,
  "alg": "aes-256-gcm",
  "iv": "base64-12-byte-iv",
  "ciphertext": "base64-ciphertext"
}
```

И затем это целиком сериализовать в строку:

```text
{"v":1,"alg":"aes-256-gcm","iv":"...","ciphertext":"..."}
```

Либо в base64 от этого JSON.

Главное — mobile и web должны использовать один и тот же формат.

### Рекомендуемый формат wrapped key

Для `encrypted_keys[device_id]` удобно хранить компактную строку с envelope:

```json
{
  "v": 1,
  "alg": "x25519-hkdf-aes256gcm",
  "epk": "base64-ephemeral-public-key",
  "iv": "base64-12-byte-iv",
  "ciphertext": "base64-wrapped-message-key"
}
```

Также как строку JSON или base64-JSON.

---

## 1. Генерация device keys

Каждое устройство должно иметь свой собственный key pair.

### Mobile

- генерирует `device_id`
- генерирует `X25519 key pair`
- хранит private key в secure storage
- отправляет public key на backend

### Web

- генерирует `web_device_id`
- генерирует `X25519 key pair`
- хранит private key в `IndexedDB`
- отправляет public key на backend

## Что нельзя делать

- нельзя использовать один и тот же private key на mobile и web
- нельзя хранить private key web в `localStorage`
- нельзя передавать private key на backend

---

## 2. Загрузить public key устройства

После генерации device keypair клиент должен загрузить public key на backend.

### Request

```bash
curl -X POST "$BASE_URL/api/v1/e2ee/keys" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "mobile-device-1",
    "public_key": "base64-x25519-public-key"
  }'
```

### Response

```json
{
  "message": "public key uploaded successfully"
}
```

## Когда вызывать

- mobile: после первой генерации keys
- mobile: после reinstall / нового устройства
- web: после approve linked device или в рамках pairing flow

---

## 3. Получить public keys собеседника

Перед отправкой E2EE сообщения клиенту нужно получить все public keys получателя.

### Request

```bash
curl "$BASE_URL/api/v1/e2ee/keys/35" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response

```json
{
  "user_id": 35,
  "keys": {
    "mobile-device-1": "base64-public-key-1",
    "web-device-1": "base64-public-key-2",
    "tablet-device-1": "base64-public-key-3"
  }
}
```

## Важно

Чтобы sender тоже мог читать своё отправленное сообщение на своих других устройствах, отправителю нужно получить:

- ключи собеседника
- и свои собственные ключи

То есть sender обычно делает два запроса:

```bash
curl "$BASE_URL/api/v1/e2ee/keys/$MY_USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```bash
curl "$BASE_URL/api/v1/e2ee/keys/$PEER_USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Потом объединяет оба набора устройств в один target set.

---

## 4. Как шифровать новое personal message

### Алгоритм на клиенте

1. Сгенерировать случайный `message_key` размером `32 bytes`.
2. Взять plaintext сообщения.
3. Зашифровать plaintext через `AES-256-GCM` с `message_key`.
4. Получить ciphertext envelope для поля `content`.
5. Для каждого `device_id` из набора target devices:
   - взять `public_key`
   - зашифровать `message_key` на это устройство
   - положить результат в `keys[device_id]`
6. Отправить ciphertext и `keys` на backend.

## Что отправляется на backend

- `content` = ciphertext, а не plaintext
- `content_hash` = hash plaintext, если вы его используете
- `keys` = map `device_id -> wrapped_message_key`

## Пример request для personal chat

```bash
curl -X POST "$BASE_URL/api/v1/conversations/077f91e0-6abd-4204-a3fa-98fe10d120dc/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "{\"v\":1,\"alg\":\"aes-256-gcm\",\"iv\":\"base64-iv\",\"ciphertext\":\"base64-ciphertext\"}",
    "content_hash": "sha256-of-plaintext",
    "keys": {
      "my-mobile-device": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"epk\":\"base64\",\"iv\":\"base64\",\"ciphertext\":\"base64\"}",
      "my-web-device": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"epk\":\"base64\",\"iv\":\"base64\",\"ciphertext\":\"base64\"}",
      "peer-mobile-device": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"epk\":\"base64\",\"iv\":\"base64\",\"ciphertext\":\"base64\"}",
      "peer-web-device": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"epk\":\"base64\",\"iv\":\"base64\",\"ciphertext\":\"base64\"}"
    },
    "type": "text"
  }'
```

### Response `201 Created`

Придёт `MessageView`, внутри которого уже будет сохранённый ciphertext и `encrypted_keys`.

У сообщения есть поля:

- `content`
- `content_hash`
- `encrypted_keys`
- `type`
- `created_at`

### Что это значит

Клиент не должен ждать plaintext от backend.

Backend вернёт сообщение в том же шифрованном виде, а клиент сам его расшифрует.

---

## 5. Как расшифровывать сообщение

Когда mobile или web получает `MessageView`, он должен:

1. определить свой текущий `device_id`
2. взять `encrypted_keys[device_id]`
3. расшифровать wrapped key своим private key и получить `message_key`
4. расшифровать `content` с помощью `message_key`
5. показать plaintext пользователю

## Что делать, если `encrypted_keys[device_id]` нет

Это значит:

- это устройство не было включено в message fan-out при отправке
- либо это новый linked web device
- либо для web ещё не прошёл history sync

В таком случае:

- web не сможет прочитать старое сообщение сам по себе
- mobile должен сделать history sync re-wrap

---

## 6. Получить сообщения и расшифровать их

### Request

```bash
curl "$BASE_URL/api/v1/conversations/077f91e0-6abd-4204-a3fa-98fe10d120dc/messages?limit=50&offset=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response

Примерно:

```json
{
  "messages": [
    {
      "id": "2f9f5e4d-c425-4cff-bf44-2f7cfc52a8df",
      "conversation_id": "077f91e0-6abd-4204-a3fa-98fe10d120dc",
      "sender_id": 35,
      "content": "{\"v\":1,\"alg\":\"aes-256-gcm\",\"iv\":\"base64-iv\",\"ciphertext\":\"base64-ciphertext\"}",
      "content_hash": "sha256-of-plaintext",
      "encrypted_keys": {
        "my-web-device": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"epk\":\"base64\",\"iv\":\"base64\",\"ciphertext\":\"base64\"}",
        "my-mobile-device": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"epk\":\"base64\",\"iv\":\"base64\",\"ciphertext\":\"base64\"}"
      },
      "type": "text",
      "created_at": "2026-03-28T12:00:00Z"
    }
  ],
  "count": 1
}
```

### Дальше делает клиент

- находит запись `encrypted_keys[current_device_id]`
- получает `message_key`
- расшифровывает `content`

---

## 7. Web linked device и старая история

Если web подключён как новый linked device, старые сообщения не будут автоматически содержать ключ для нового `web_device_id`.

Поэтому mobile после approve должен сделать `history sync`.

### Request

```bash
curl -X POST "$BASE_URL/api/v1/e2ee/web/pairing/sessions/0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f/history" \
  -H "Authorization: Bearer $MOBILE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "web_device_id": "web-device-1",
    "items": [
      {
        "message_id": "2f9f5e4d-c425-4cff-bf44-2f7cfc52a8df",
        "encrypted_key_for_web": "{\"v\":1,\"alg\":\"x25519-hkdf-aes256gcm\",\"epk\":\"base64\",\"iv\":\"base64\",\"ciphertext\":\"base64\"}"
      }
    ]
  }'
```

### Response

```json
{
  "pairing_id": "0f8b76fb-0ec8-46a5-aa2e-d6a74fd2f38f",
  "web_device_id": "web-device-1",
  "status": "synced",
  "synced_count": 1,
  "synced_at": "2026-03-28T12:05:00Z"
}
```

### Что это даёт web

После этого старое сообщение начнёт содержать:

- `encrypted_keys["web-device-1"]`

И web сможет расшифровать историю тем же способом, как и mobile.

---

## 8. Key backup для восстановления устройства

Это опциональный, но полезный flow.

### Сохранить backup

Приватный ключ должен быть зашифрован на клиенте до отправки.

```bash
curl -X POST "$BASE_URL/api/v1/e2ee/backup" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted_private_key": "base64-aes-gcm-private-key",
    "salt": "base64-random-salt",
    "iv": "base64-12-byte-iv",
    "kdf_algorithm": "argon2id",
    "version": 1
  }'
```

### Response

```json
{
  "message": "key backup saved successfully"
}
```

### Получить backup

```bash
curl "$BASE_URL/api/v1/e2ee/backup" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response

```json
{
  "user_id": 35,
  "encrypted_private_key": "base64-aes-gcm-private-key",
  "salt": "base64-random-salt",
  "iv": "base64-12-byte-iv",
  "kdf_algorithm": "argon2id",
  "version": 1,
  "created_at": "2026-03-28T12:00:00Z",
  "updated_at": "2026-03-28T12:00:00Z"
}
```

### Что делает новый клиент

- просит у пользователя мастер-пароль
- выводит key-encryption key через KDF
- расшифровывает `encrypted_private_key` локально

---

## 9. Как web и mobile должны работать одинаково

Обе команды должны согласовать:

- одинаковый crypto profile
- одинаковую сериализацию ciphertext envelope
- одинаковую сериализацию wrapped key envelope
- одинаковый `content_hash` policy
- одинаковый способ base64 encoding

## Минимальный обязательный контракт между mobile и web

- `device_id` уникален на устройство
- `public_key` всегда в одном формате
- `content` всегда в одном формате
- `encrypted_keys[device_id]` всегда в одном формате
- `current_device_id` всегда известен локально

---

## 10. Как читать новые сообщения на web после QR login

После approve и redeem web должен:

1. знать свой `web_device_id`
2. иметь private key в `IndexedDB`
3. уметь расшифровывать `encrypted_keys[web_device_id]`
4. после history sync расшифровывать старые сообщения
5. для новых сообщений работать как обычное устройство

Если sender правильно формирует `keys` для всех активных устройств, то новые сообщения на web будут читаться сразу.

---

## 11. Что обязательно сделать отправителю

При отправке personal message sender должен включать в `keys`:

- все активные устройства получателя
- и свои активные устройства

Иначе:

- собеседник сможет не увидеть сообщение на одном из устройств
- sender сам не сможет прочитать своё отправленное сообщение на другом своём устройстве

---

## 12. Что frontend / mobile должны делать по websocket

Если realtime сообщение приходит через websocket в том же формате `MessageView`, логика не меняется:

1. получить сообщение
2. взять `encrypted_keys[current_device_id]`
3. расшифровать `message_key`
4. расшифровать `content`
5. показать plaintext

То есть websocket — это только transport, не отдельный crypto flow.

---

## 13. Что не стоит делать

- не отправлять plaintext сообщения на backend
- не хранить private key на backend
- не использовать один private key для mobile и web
- не ожидать, что новый web сам откроет старую историю без history sync
- не делать web без device identity

---

## 14. Короткий итог

Если коротко:

- у каждого устройства свой `device_id` и свой key pair
- публичный ключ устройства загружается через `/api/v1/e2ee/keys`
- перед отправкой sender получает public keys устройств
- plaintext шифруется в `content`
- `message_key` шифруется отдельно для каждого `device_id` и кладётся в `keys`
- получатель расшифровывает своё сообщение через `encrypted_keys[current_device_id]`
- web как linked device читает старую историю только после history sync

---

## 15. Связанные документы

- [Frontend QR Login Flow Guide](/Users/askar.abylkhaiyrov.00gmail.com/Desktop/backend/go/alem-super-app-backend/docs/frontend_web_qr_login_guide.md)
- [Mobile Linked Devices API Guide](/Users/askar.abylkhaiyrov.00gmail.com/Desktop/backend/go/alem-super-app-backend/docs/mobile_linked_devices_api_guide.md)
- [E2EE Web Pairing Frontend Contract](/Users/askar.abylkhaiyrov.00gmail.com/Desktop/backend/go/alem-super-app-backend/docs/e2ee_web_pairing_contract.md)
- [E2EE Web Pairing And History Sync](/Users/askar.abylkhaiyrov.00gmail.com/Desktop/backend/go/alem-super-app-backend/docs/e2ee_web_pairing_architecture.md)
