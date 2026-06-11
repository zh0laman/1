# E2EE Web Pairing And History Sync

## Что уже есть в проекте

Сейчас backend уже поддерживает базовую multi-device E2EE модель:

- у пользователя есть публичные ключи по `device_id` в `user_public_keys`
- у сообщения есть `encrypted_keys` в `messages`
- есть backup приватного ключа пользователя в `user_key_backups`
- chat realtime уже идет через websocket
- основная авторизация идет через Keycloak bearer token

Это хорошая база для web-клиента, но есть одно важное ограничение.

## Главная проблема

Если web открывается как новое устройство, у него будет:

- новый `device_id`
- новая пара ключей

Но старые сообщения уже сохранены с `encrypted_keys` для старых устройств, которые существовали в момент отправки. Значит:

- просто создать новый web key pair недостаточно
- просто восстановить backup приватного ключа пользователя недостаточно, если старые сообщения были зашифрованы не на этот `device_id`

Именно поэтому для web-клиента нужен отдельный шаг pair/sync, как в WhatsApp Web.

## Правильная модель для web

Нужно считать браузер полноценным устройством.

При первом открытии web-клиента браузер должен:

1. Сгенерировать `device_id` (UUID).
2. Сгенерировать device key pair для E2EE.
3. Сохранить приватный ключ локально:
   - лучше в `IndexedDB`
   - через `WebCrypto`
   - по возможности как non-extractable key
4. До подтверждения с мобильного не считать это устройство доверенным.

То есть web не "без устройства". Web и есть устройство.

## Как открыть старые сообщения

Для вашей текущей схемы лучше всего подходит `history key re-wrap`.

### Идея

Мобильное приложение уже умеет расшифровывать старые сообщения своим device key. После QR pair оно должно:

1. Получить public key нового web-устройства.
2. Для каждого старого сообщения:
   - расшифровать message key своим ключом
   - зашифровать этот же message key на `web_device_id`
3. Отправить на сервер batch обновление `encrypted_keys`.

В результате:

- ciphertext сообщения не меняется
- сервер не видит plaintext
- в `messages.encrypted_keys` просто появляется новый ключ для web-устройства
- web сразу может читать историю

Это минимально ломает текущую модель хранения.

### Почему не только key backup

Текущий `user_key_backups` полезен как fallback, но сам по себе он не решает всю задачу.

Если старое сообщение содержит:

- `encrypted_keys["mobile-device-1"]`
- `encrypted_keys["mobile-device-2"]`

а web пришел как:

- `encrypted_keys["web-device-1"]` отсутствует

то web все равно не сможет открыть историю, даже имея свой новый приватный ключ.

Значит нужен один из двух вариантов:

- либо перенос старой device identity на web
- либо `history re-wrap` старых message keys на новый `web_device_id`

Для вашего backend второй вариант проще и безопаснее.

## Рекомендуемый flow как в WhatsApp Web

### 1. Web создает pairing session

Новый endpoint:

- `POST /api/v1/web/pairing/sessions`

Backend создает короткоживущую pairing session:

- `pairing_id`
- `qr_token` или `pairing_secret`
- `expires_at`
- `web_device_id`
- `web_public_key`
- `web_ephemeral_pub`

Web кодирует это в QR.

Пример полезной нагрузки QR:

```json
{
  "type": "web_pairing",
  "pairing_id": "uuid",
  "qr_token": "random-secret",
  "web_device_id": "uuid",
  "web_public_key": "base64",
  "web_ephemeral_pub": "base64",
  "expires_at": "2026-03-28T10:00:00Z"
}
```

### 2. Мобильное приложение сканирует QR

Мобильное приложение:

1. Проверяет срок жизни QR.
2. Отправляет на backend подтверждение pairing.
3. Использует уже существующую Keycloak-authenticated сессию пользователя.

Новый endpoint:

- `POST /api/v1/web/pairing/sessions/{pairing_id}/approve`

Body:

```json
{
  "qr_token": "random-secret",
  "web_device_id": "uuid",
  "web_public_key": "base64",
  "device_name": "Chrome on MacBook",
  "platform": "web",
  "history_sync": true
}
```

Backend после этого:

- привязывает `web_device_id` к пользователю
- сохраняет public key в `user_public_keys`
- переводит pairing session в `approved`

### 3. Мобильное приложение запускает history sync

Новый endpoint:

- `POST /api/v1/e2ee/history-sync`

Или более узко:

- `POST /api/v1/web/pairing/sessions/{pairing_id}/history`

Мобильное приложение батчами отправляет новые wrapped keys:

```json
{
  "web_device_id": "uuid",
  "items": [
    {
      "message_id": "uuid",
      "encrypted_key_for_web": "base64"
    }
  ]
}
```

Backend обновляет `messages.encrypted_keys`, добавляя запись:

- `encrypted_keys[web_device_id] = encrypted_key_for_web`

Важно:

- сервер только сохраняет новый wrapped key
- ciphertext в `content` не меняется
- сервер plaintext не знает

### 4. Web получает login/session

После approve web должен получить backend session.

Тут есть 2 нормальных варианта.

#### Вариант A. Отдельная backend web session

Самый практичный вариант для вашего проекта.

Backend после approve выдает:

- short-lived `web_login_code`

Web обменивает его на:

- httpOnly cookie
- или backend JWT для web

Тогда middleware должен принимать:

- либо Keycloak bearer
- либо backend-issued web session

Плюсы:

- не нужно передавать пароль
- не нужно передавать Keycloak refresh token в браузер через QR
- flow проще контролировать

#### Вариант B. Keycloak token exchange

Если хотите, чтобы web жил только на Keycloak токенах, можно сделать обмен через Keycloak token exchange или похожий SSO flow. Но это зависит от вашей конфигурации Keycloak и обычно сложнее в реализации.

Для быстрого запуска web-клиента лучше использовать Вариант A.

## Что делать с будущими сообщениями

После успешного pair все новые сообщения начинают работать автоматически, если отправитель шифрует message key:

- на все device keys получателя
- и на собственные активные устройства отправителя

То есть frontend при отправке должен собирать ключи:

- устройств собеседника
- своих устройств

И формировать `keys` для `SendMessageRequest`.

Если web key уже лежит в `user_public_keys`, он попадет в обычный E2EE flow без отдельных костылей.

## Что нужно поменять в данных

Минимально рекомендую добавить отдельную таблицу pairing-сессий.

Пример:

```sql
CREATE TABLE web_pairing_sessions (
    id UUID PRIMARY KEY,
    qr_token_hash TEXT NOT NULL,
    user_id BIGINT NULL REFERENCES users(id) ON DELETE CASCADE,
    web_device_id VARCHAR(255) NOT NULL,
    web_public_key TEXT NOT NULL,
    web_ephemeral_pub TEXT,
    status VARCHAR(32) NOT NULL, -- pending, approved, synced, expired, revoked
    approved_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

И желательно хранить метаданные устройства:

- `device_name`
- `platform`
- `last_seen_at`
- `is_trusted`

Это можно держать:

- либо в отдельной `user_chat_devices`
- либо расширить текущую модель вокруг `user_public_keys`

## Что поменять в API

Минимальный набор:

- `POST /api/v1/web/pairing/sessions`
- `GET /api/v1/web/pairing/sessions/{id}`
- `POST /api/v1/web/pairing/sessions/{id}/approve`
- `POST /api/v1/web/pairing/sessions/{id}/history`
- `POST /api/v1/web/pairing/sessions/{id}/redeem`
- `DELETE /api/v1/devices/{device_id}`

И отдельный внутренний сервис:

- append/re-wrap message keys for new device

## Как web узнает статус pairing

Web может:

- либо long-poll `GET /web/pairing/sessions/{id}`
- либо слушать отдельный websocket канал pairing-сессии

Лучше long-poll или SSE для первого релиза, чтобы не усложнять протокол.

## Безопасность

Обязательно:

- QR должен жить 30-60 секунд
- в базе хранить hash от `qr_token`, а не сам секрет
- approve должен требовать уже авторизованную мобильную сессию
- pairing session должна быть одноразовой
- должна быть возможность revoke web device
- при logout web-устройства надо удалять public key или помечать устройство revoked

Для браузера также важно:

- не хранить приватный ключ в `localStorage`
- хранить в `IndexedDB`
- для "не доверенного" браузера можно держать ключ только до logout

## Важное ограничение текущей схемы

Если у вас большие группы, текущая модель "per-message wrapped key for every device" может стать тяжелой.

Тогда следующим этапом стоит перейти на:

- Sender Keys для групп
- или conversation history keys

Но для старта web-клиента и вашей текущей таблицы `encrypted_keys` это не обязательно. `History re-wrap` уже решает задачу.

## Практическая рекомендация

Для вашего текущего backend оптимальный путь такой:

1. Web считать отдельным устройством.
2. Делать QR pair через мобильное приложение.
3. После pair сохранять `web_device_id` + `web_public_key`.
4. Запускать history sync с мобильного:
   - старые message keys re-wrap на web device
   - backend только дописывает `encrypted_keys`
5. Для web auth использовать отдельную backend web session.
6. Для следующих сообщений использовать уже существующий `/e2ee/keys/{user_id}` flow.

## Итог

Если коротко:

- web должен иметь свой `device_id` и свою key pair
- старую историю нельзя открыть "сама по себе", если в старых сообщениях нет wrapped keys для web
- поэтому после QR scan мобильный клиент должен передать web доступ к истории через `history re-wrap`
- это самый близкий к WhatsApp Web подход для вашей текущей архитектуры

