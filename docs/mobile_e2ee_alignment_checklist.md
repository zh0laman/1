# Что Нужно Узнать От Mobile Разработчика Для Корректной E2EE Интеграции

## Цель

Этот документ нужен, чтобы web и mobile использовали один и тот же E2EE-протокол.

Сейчас web получает зашифрованные сообщения, но часть payload приходит в формате, который web не может однозначно распознать и расшифровать.

Чтобы убрать несовместимость, от mobile-разработчика нужно получить точные ответы и примеры по каждому пункту ниже.

---

## 1. Формат `content`

Нужно точно узнать, в каком виде mobile отправляет поле `content` в `POST /api/v1/conversations/{conversation_id}/messages`.

Нужно ответить:

1. `content` содержит:
   - plaintext
   - JSON string
   - base64 от JSON
   - просто base64 ciphertext
   - другой формат
2. Если это JSON или base64(JSON), как выглядит полный envelope.
3. Если это просто base64 ciphertext, где тогда хранятся:
   - `iv`
   - `nonce`
   - `auth tag`
   - версия формата
   - название алгоритма
4. Используется обычный `base64` или `base64url`.
5. Есть ли padding `=`.

Нужно попросить mobile прислать:

- один реальный пример `content` для нового personal-сообщения
- этот же пример в расшифрованном объяснении:
  - где `iv`
  - где `ciphertext`
  - где `tag`
  - где `version`

---

## 2. Формат `encrypted_keys`

Нужно точно узнать формат значения внутри:

- `keys[device_id]` при отправке
- `encrypted_keys[device_id]` при чтении

Нужно ответить:

1. Это:
   - JSON string
   - base64(JSON)
   - просто base64 ciphertext
   - другой формат
2. Что именно лежит внутри:
   - `epk`
   - `iv`
   - `ciphertext`
   - `tag`
   - `version`
   - `alg`
3. Какой алгоритм реально используется для wrap message key:
   - `X25519 + HKDF + AES-GCM`
   - sealed box
   - HPKE
   - другое
4. В каком формате кодируется public key:
   - raw 32 bytes
   - SPKI
   - другой
5. В каком формате кодируется private key на mobile.

Нужно попросить mobile прислать:

- один реальный пример `encrypted_keys[web_device_id]`
- расшифровку структуры этого значения по полям

---

## 3. Алгоритм шифрования сообщения

Нужно точно узнать криптографический профиль mobile.

Нужно ответить:

1. Какой алгоритм используется для шифрования содержимого сообщения.
2. Какая длина `message_key`.
3. Какая длина `iv/nonce`.
4. Как формируется `auth tag`.
5. Какой hash/KDF используется.
6. Какой алгоритм для device identity key:
   - `X25519`
   - `ECDH P-256`
   - другой

Нужно получить от mobile:

- точную схему:
  - generate message key
  - encrypt plaintext
  - wrap message key per device
  - serialize content
  - serialize wrapped key

---

## 4. Политика сериализации

Нужно точно узнать, как mobile сериализует payload перед отправкой.

Нужно ответить:

1. Используется ли `JSON.stringify`.
2. Применяется ли потом `base64(JSON.stringify(...))`.
3. Есть ли двойное кодирование.
4. Есть ли `TextEncoder/UTF-8` перед base64.
5. Есть ли url-safe замена:
   - `+` -> `-`
   - `/` -> `_`
6. Сохраняется ли `=` padding.

Нужно попросить mobile прислать:

- кусок реального кода сериализации `content`
- кусок реального кода сериализации wrapped key

---

## 5. Что Mobile Отправляет На Backend Для Нового Personal Message

Нужно получить один полный пример реального request body при отправке нового сообщения.

Нужен полный JSON:

```json
{
  "content": "...",
  "content_hash": "...",
  "keys": {
    "device-1": "...",
    "device-2": "..."
  },
  "type": "text"
}
```

Нужно, чтобы mobile отдельно объяснил:

1. Почему `content` выглядит именно так.
2. Почему `keys[device_id]` выглядят именно так.
3. Какие устройства попадают в `keys`.
4. Включается ли туда текущий `web_device_id`.
5. Включаются ли туда собственные устройства отправителя.

---

## 6. Включается Ли `web_device_id` В Fan-Out Для Новых Сообщений

Это критично.

Нужно прямо спросить mobile:

1. После QR approve попадает ли новый `web_device_id` в список целевых устройств для новых сообщений.
2. С какого момента это происходит:
   - сразу после `approve`
   - только после `history sync`
   - только после `redeem`
   - после отдельного обновления device list
3. Есть ли кейсы, когда mobile продолжает шифровать только на старые mobile-device ключи.

Нужно попросить mobile проверить на одном новом сообщении:

- есть ли в `keys` ключ именно для текущего web device
- совпадает ли `device_id` с тем, который был создан в QR flow

---

## 7. Связка QR Pairing И E2EE Device Identity

Нужно подтвердить, что mobile реально использует тот же `web_device_id`, который был показан в QR payload и подтвержден через `approve`.

Нужно ответить:

1. Совпадает ли `web_device_id` из QR с `device_id`, который mobile использует для wrap новых message keys.
2. Не создается ли на mobile другой внутренний `device_id`.
3. Не нормализуется ли `device_id` по-другому.
4. Не меняется ли формат `public_key` при approve.

Нужно попросить mobile прислать:

- пример `pairing_id`
- `web_device_id` из QR
- `web_device_id`, который mobile использовал в `history`
- `web_device_id`, который mobile использовал в новых `keys`

Они должны совпадать.

---

## 8. History Sync

Нужно узнать, как mobile делает history sync и делает ли вообще.

Нужно ответить:

1. Вызывается ли `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/history`.
2. Когда именно он вызывается.
3. Какими батчами.
4. Как mobile определяет, какие сообщения надо re-wrap.
5. Что mobile считает завершением sync.
6. Отправляет ли mobile финальный пустой batch.

Нужно попросить mobile прислать:

- один реальный request body для `history`
- один реальный response body
- пример `encrypted_key_for_web`

---

## 9. Проверка Совместимости WebCrypto И Mobile Crypto

Нужно убедиться, что mobile использует формат, который web реально сможет воспроизвести через браузерный `WebCrypto`.

Нужно ответить:

1. Может ли mobile дать тест-вектор:
   - plaintext
   - message_key
   - iv
   - serialized content
   - device public/private keys
   - serialized wrapped key
2. Можно ли по этим данным воспроизвести decrypt вне mobile.
3. Использует ли mobile нестандартную библиотечную упаковку ciphertext.

Нужно попросить mobile прислать минимум 1 тест-вектор для:

- encrypt content
- wrap message key
- decrypt content
- unwrap message key

---

## 10. Примеры Которые Нужно Обязательно Получить От Mobile

Ниже список данных, которые mobile должен дать без сокращений.

### A. Полный пример нового personal message

- request body при отправке
- response body от backend
- websocket `new_message`, если отличается

### B. Полный пример старого сообщения после history sync

- как выглядело `encrypted_keys` до sync
- как выглядит `encrypted_keys` после sync

### C. Полный пример одного рабочего кейса

- QR created
- approve
- history sync
- redeem
- новое сообщение
- чтение этого сообщения на web

---

## 11. Прямые Вопросы Mobile Разработчику

Вот короткий список вопросов, который можно отправить ему как есть.

1. В каком точном формате mobile отправляет `content` для E2EE personal message?
2. В каком точном формате mobile отправляет `keys[device_id]`?
3. Это raw JSON, base64(JSON), base64 ciphertext или другой формат?
4. Где именно хранятся `iv`, `nonce`, `tag`, `alg`, `version`?
5. Какой именно алгоритм используется для message encryption?
6. Какой именно алгоритм используется для wrapping `message_key`?
7. Используется `base64` или `base64url`?
8. Есть ли padding `=`?
9. Включает ли mobile текущий `web_device_id` в `keys` для новых сообщений после QR approve?
10. Совпадает ли `web_device_id` из QR, approve, history sync и новых сообщений?
11. Делает ли mobile `history sync` реально, и можно ли показать живой request/response?
12. Можете прислать один полный `MessageView` JSON для нового сообщения, которое web должен уметь расшифровать?
13. Можете прислать один пример `encrypted_keys[web_device_id]` и объяснить его структуру?
14. Можете прислать кусок реального mobile-кода, где сериализуется `content` и `keys`?

---

## 12. Что Нам Нужно От Mobile В Идеале

Идеальный ответ от mobile должен содержать:

1. Точный crypto profile.
2. Точный serialization format.
3. Один полный рабочий пример отправки personal message.
4. Один полный рабочий пример history sync.
5. Один тест-вектор для web.
6. Подтверждение, что новый `web_device_id` реально входит в `keys` новых сообщений.

Без этого web-разработчик будет только гадать по ciphertext, а это приводит к несовместимости между клиентами.
