# Ответы Mobile По E2EE Alignment Checklist

Источник ответов: текущая мобильная реализация в этом репозитории (`E2EEService`, отправка personal message, QR linked-devices flow, history sync controller).

Важно: ниже ответы **по коду**, а не по runtime-дампам прода. Для пунктов, где требуются «живые примеры», нужны фактические payload из логов/перехвата.

---

## 1. Формат `content`

1. `content` для E2EE personal message:
- это **base64 ciphertext envelope** (не plaintext, не base64(JSON)).

2. Полный envelope `content`:
- формат: `Base64(content_iv[12] + ciphertext + tag[16])`
- версия формата: V4 (по комментариям и реализации).

3. Где `iv/nonce/tag/version/alg`:
- `iv/nonce` и `tag` не отдельными JSON-полями, а **внутри бинарного blob**:
  - первые `12` байт: nonce (IV)
  - последние `16` байт: auth tag
  - середина: ciphertext
- версия/alg задаются протоколом в коде, не сериализуются отдельными полями внутри `content`.

4. Base64 тип:
- используется обычный `base64` (`dart:convert base64Encode`), не `base64url`.

5. Padding:
- сохраняется стандартный `=` padding.

Что отправляется перед шифрованием:
- перед encrypt mobile делает `json.encode({'text': content, 'type': type})`, далее UTF-8 байты этого JSON шифруются.

---

## 2. Формат `encrypted_keys`

1. Формат `keys[device_id]` / `encrypted_keys[device_id]` (V4):
- **base64 бинарный blob**, не JSON.

2. Структура blob:
- `Base64(ephemeral_pub[32] + key_iv[12] + encrypted_message_key + key_tag[16])`

3. Алгоритм wrap:
- `X25519 + HKDF(SHA-256) + AES-GCM(256)`.

4. Формат public key:
- raw 32 bytes X25519, затем base64.

5. Формат private key на mobile:
- raw private key bytes (seed/secret bytes), затем base64 в secure storage.

---

## 3. Алгоритм шифрования сообщения

1. Шифрование содержимого:
- `AES-GCM 256`.

2. Длина `message_key`:
- `32` bytes.

3. Длина `iv/nonce`:
- `12` bytes.

4. Auth tag:
- `16` bytes (стандарт AES-GCM).

5. Hash/KDF:
- для wrapping key: `HKDF(HMAC-SHA256, outputLength=32)`.

6. Device identity key:
- `X25519`.

Схема:
1. generate random content key (32 bytes)  
2. encrypt plaintext(JSON) -> `content` blob  
3. per target device wrap content key через X25519 shared secret + HKDF + AES-GCM  
4. serialize `content` как base64(blob)  
5. serialize wrapped key как base64(blob)

---

## 4. Политика сериализации

1. `JSON.stringify` эквивалент:
- да (`json.encode`) для plaintext payload `{'text','type'}`.

2. `base64(JSON.stringify(...))` для `content`:
- нет; JSON сначала шифруется, затем base64 уже от бинарного encrypted envelope.

3. Двойное кодирование:
- для V4 `content` и `keys` двойного JSON/base64-обёртывания нет.

4. UTF-8 перед base64:
- да, JSON превращается в UTF-8 bytes перед шифрованием.

5. URL-safe замены:
- не применяются для отправки сообщений (`+/-`, `/_` не заменяются).

6. `=` padding:
- сохраняется.

---

## 5. Что mobile отправляет на backend для нового personal message

Фактическая структура request body:

```json
{
  "content": "<base64(iv+ciphertext+tag)>",
  "type": "<original message type, например text>",
  "keys": {
    "<device_id_1>": "<base64(ephemeral_pub+key_iv+enc_key+key_tag)>",
    "<device_id_2>": "<...>"
  },
  "reply_to_id": "<optional>",
  "content_hash": "<optional>",
  "metadata": "<optional>",
  "is_ephemeral": "<optional>",
  "ttl_seconds": "<optional>"
}
```

Почему так:
1. `content` — зашифрованный envelope V4.  
2. `keys[device_id]` — per-device wrapped content key V4.  
3. В `keys` входят recipient devices + sender devices + текущий device отправителя (форсируется в коде).

---

## 6. Включается ли `web_device_id` в fan-out новых сообщений

1. Да, если backend уже вернул web device key в `/e2ee/keys` для пользователя.

2. С какого момента:
- технически с момента, когда `_getCachedUserKeys(...)` начинает видеть этот `web_device_id`.
- после QR `approve` это обычно возможно сразу, но реально зависит от backend и кеша ключей на mobile (в коде есть TTL кеша 10 сек).

3. Возможны кейсы «шифруется только на старые ключи»:
- да, если backend ещё не отдал web device в keys-map (или кеш не обновился).

---

## 7. Связка QR pairing и E2EE device identity

1. В текущем flow mobile проверяет соответствие:
- `web_device_id` из preview == `web_device_id` из QR,
- `web_public_key` из preview == `web_public_key` из QR (если оба есть).

2. Другой внутренний `web_device_id` mobile не генерирует.

3. Нормализация `device_id` не выполняется.

4. Формат `public_key` при approve не меняется (передаётся как строка из QR/preview).

Для новых сообщений device fan-out берётся из backend key list, поэтому конечная консистентность зависит от backend записи в `/e2ee/keys`.

---

## 8. History Sync

1. `POST /api/v1/e2ee/web/pairing/sessions/{pairing_id}/history` — да, вызывается.

2. Когда:
- сразу после успешного `approve`, на blocking экране `Syncing chat history`.

3. Батчи:
- `200` items.

4. Как выбираются сообщения:
- personal/group conversations (AI исключается),
- постранично все messages,
- берутся сообщения, где есть `encrypted_keys/keys`.

5. Критерий завершения:
- `completed` (без ошибок),
- `completed_with_warnings` (частичные ошибки),
- `failed`.

6. Финальный пустой batch:
- не отправляется.

Retry:
- до `3` попыток на батч, backoff `1s -> 2s -> 4s`.

---

## 9. Совместимость WebCrypto и mobile crypto

1. По коду профиль совместим с web:
- X25519 (ECDH), HKDF-SHA256, AES-GCM(256), явный nonce/tag.

2. Воспроизводимость decrypt вне mobile:
- теоретически да, если дать тест-векторы и ключи.

3. Нестандартная «библиотечная упаковка»:
- нет, используется собственная явная бинарная упаковка (конкатенация байтов в фиксированном порядке).

---

## 10. Обязательные примеры (статус)

### A. Новый personal message (request/response/ws)
- **По коду формат определён**, но живые payload нужно снять из runtime (лог/прокси).

### B. Старое сообщение до/после history sync
- **По коду логика есть**, но нужен фактический backend dump `encrypted_keys` до/после.

### C. Полный рабочий сценарий QR->approve->history->redeem->new_message->web_read
- Реализовано в коде, но для валидации совместимости нужен интеграционный прогон с capture payload.

---

## 11. Прямые вопросы mobile разработчику — краткие ответы

1) Формат `content`?  
`base64(iv12 + ciphertext + tag16)` (V4)

2) Формат `keys[device_id]`?  
`base64(ephemeral_pub32 + key_iv12 + encrypted_message_key + tag16)` (V4)

3) JSON/base64(JSON)/другое?  
Для V4 — base64 бинарных blob, не JSON.

4) Где iv/nonce/tag/alg/version?  
Внутри бинарной структуры по фиксированным позициям; alg/version задаются протоколом.

5) Message encryption algorithm?  
AES-GCM-256.

6) Wrapping algorithm?  
X25519 + HKDF-SHA256 + AES-GCM-256.

7) base64 или base64url?  
base64.

8) Есть `=` padding?  
Да.

9) Включается ли `web_device_id` после approve?  
Да, когда backend key list уже содержит этот device.

10) Совпадает ли `web_device_id` в QR/approve/history/new keys?  
В mobile flow да; для новых сообщений окончательно зависит от backend list.

11) Делается ли history sync реально?  
Да, вызывается после approve, батчами 200.

12) Полный MessageView JSON для web decrypt?  
Нужно снять runtime пример.

13) Пример `encrypted_keys[web_device_id]` со структурой?  
Формат известен; живой пример нужно снять.

14) Реальный код сериализации?  
Да, в `E2EEService.encryptMessageHybrid` и send flow в `chat_detail_page.dart`.

---

## 12. Что нужно дополнительно собрать (чтобы закрыть вопрос полностью)

1. 1 живой request+response на новый personal E2EE message.  
2. 1 живой history batch request+response.  
3. 1 тест-вектор (plaintext/key/iv/content/wrapped_key), чтобы web воспроизвёл decrypt/unwrap независимо.

