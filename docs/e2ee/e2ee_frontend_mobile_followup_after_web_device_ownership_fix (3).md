# Mobile E2EE Technical Audit (Full Answer)

Источник: только текущий mobile-код этого репозитория.

- Базовый промпт: `docs/e2ee_mobile_full_explanation_prompt.md`
- В ответе ниже каждый ключевой тезис привязан к конкретному исходнику.
- Если поведение не подтверждено кодом, это явно отмечено.

---

## 1. High-Level Architecture

### 1.1 Ключевые сущности

1. `E2EEService` — основной runtime E2EE сервис: генерация/загрузка ключей, шифрование/дешифрование сообщений, backup create/restore, key wrapping/unwrapping, cache ключей устройств.
- `lib/core/services/e2ee_service.dart:7`

2. `E2EERemoteDataSource` — E2EE backend API клиент.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:4`

3. `AuthController` — orchestration входа и инициализации E2EE (`_initE2EE`), restore-first для password login.
- `lib/features/auth/presentation/logic/auth_controller.dart:106`

4. `LinkedDevicesController` + `WebPairingRemoteDataSource` — QR/linked-device flow (preview/approve/reject/history, device list/revoke).
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:14`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:45`

5. `MessagesRemoteDataSource` + `chat_detail_page.dart` — отправка personal message с `content + keys`, дешифрование входящих/истории.
- `lib/features/chat/data/datasources/messages_remote_datasource.dart:15`
- `lib/features/chat/presentation/pages/chat_detail_page.dart:3314`
- `lib/features/chat/presentation/pages/chat_detail_page.dart:1160`

### 1.2 Типы ключей и identity

1. Device identity key pair: X25519 private/public key pair.
- Генерация: `newKeyPair()`
- Хранение: base64 private/public в secure storage.
- `lib/core/services/e2ee_service.dart:13`
- `lib/core/services/e2ee_service.dart:279`
- `lib/core/services/e2ee_service.dart:285`

2. Device ID: UUID v4, хранится отдельно.
- `lib/core/services/e2ee_service.dart:269`
- `lib/core/services/e2ee_service.dart:271`

3. Message content key: одноразовый AES-256 ключ на сообщение (`newSecretKey()`), генерируется при `encryptMessageHybrid`.
- `lib/core/services/e2ee_service.dart:996`

4. Wrapping ephemeral key pair: одноразовый X25519 key pair на целевое устройство при wrap message key.
- `lib/core/services/e2ee_service.dart:1074`

5. Backup-derived key: PBKDF2-HMAC-SHA256 из master password.
- `lib/core/services/e2ee_service.dart:18`
- `lib/core/services/e2ee_service.dart:879`

### 1.3 Source of truth

1. Mobile — source of truth для локального private key material (в secure storage и runtime).
- `lib/core/services/e2ee_service.dart:288`

2. Backend — source of truth для device public keys map пользователя (`/e2ee/keys/{userId}`), remote backup (`/e2ee/backup`), linked devices и pairing sessions.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:37`
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:95`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:56`

### 1.4 Текстовая схема

1. Пользователь логинится -> `AuthController._initE2EE`.
2. Mobile проверяет локальные ключи; если есть password и нет локальных ключей, сначала пробует restore из remote backup.
3. Mobile инициализирует/генерирует identity key pair + device_id, публикует public key в `/e2ee/keys`.
4. При отправке personal сообщения mobile:
- шифрует payload симметрично (AES-GCM),
- делает fan-out `keys[device_id]` на recipient devices + sender devices + current mobile device.
5. При получении сообщения mobile ищет свой envelope в `keys/encrypted_keys`, unwrap message key и decrypt content.
6. В QR flow mobile делает preview/approve, затем history sync (rewrap historical message keys для web device).

---

## 2. Mobile Identity Lifecycle

### 2.1 Первый вход (password login)

1. `login(email, password)` вызывает `_initE2EE(masterPassword: password)`.
- `lib/features/auth/presentation/logic/auth_controller.dart:219`
- `lib/features/auth/presentation/logic/auth_controller.dart:272`

2. `_initE2EE` создаёт `E2EEService`.
- `lib/features/auth/presentation/logic/auth_controller.dart:127`

3. Если передан `masterPassword` и локальных ключей нет, mobile пытается restore backup (`restore-first`).
- `lib/features/auth/presentation/logic/auth_controller.dart:131`
- `lib/features/auth/presentation/logic/auth_controller.dart:135`

4. Затем всегда выполняется `initialize(accessToken, userId)`.
- `lib/features/auth/presentation/logic/auth_controller.dart:147`

5. `initialize`:
- читает private/public/device_id из secure storage;
- при валидном локальном наборе использует его и может re-upload public key при рассинхроне с сервером;
- иначе генерирует новый X25519 key pair и при отсутствии device_id генерирует UUID;
- сохраняет local keys + upload public key на backend.
- `lib/core/services/e2ee_service.dart:203`
- `lib/core/services/e2ee_service.dart:231`
- `lib/core/services/e2ee_service.dart:269`
- `lib/core/services/e2ee_service.dart:279`
- `lib/core/services/e2ee_service.dart:303`

6. После успешной инициализации при password login mobile проверяет наличие remote backup и, если его нет, создаёт и загружает backup.
- `lib/features/auth/presentation/logic/auth_controller.dart:150`
- `lib/features/auth/presentation/logic/auth_controller.dart:156`

### 2.2 Сценарии

1. Новый пользователь/новый device без локальных ключей:
- `restoreKeysFromBackup` попытка (если password login),
- при ошибке restore fallback на fresh key generation.
- `lib/features/auth/presentation/logic/auth_controller.dart:135`
- `lib/features/auth/presentation/logic/auth_controller.dart:141`
- `lib/core/services/e2ee_service.dart:267`

2. Существующий пользователь с локальными ключами:
- ключи загружаются и используются.
- `lib/core/services/e2ee_service.dart:213`

3. Reinstall app:
- в mobile-коде отдельной ветки reinstall нет;
- поведение определяется наличием/отсутствием secure storage данных после reinstall и наличием backup.

4. Новый телефон:
- в коде это эквивалент “нет локальных ключей на этом инстансе”; возможен restore-first.

5. Очистка storage:
- в коде отдельного сценария нет; эквивалент отсутствия локального key material (`hasLocalKeyMaterial == false`).
- `lib/core/services/e2ee_service.dart:311`

6. Login by PIN:
- `_initE2EE()` вызывается без `masterPassword`; restore из backup в этой ветке не запускается.
- `lib/features/auth/presentation/logic/auth_controller.dart:323`
- `lib/features/auth/presentation/logic/auth_controller.dart:375`

---

## 3. Local Storage and Secret Handling

### 3.1 Что хранится и где

1. `private identity key`
- Ключ storage: `e2ee_private_key_<userId>`
- Формат: base64 raw private key bytes
- API: `FlutterSecureStorage`
- `lib/core/services/e2ee_service.dart:34`
- `lib/core/services/e2ee_service.dart:289`

2. `public identity key`
- Ключ storage: `e2ee_public_key_<userId>`
- Формат: base64 raw public key bytes
- `lib/core/services/e2ee_service.dart:35`
- `lib/core/services/e2ee_service.dart:293`

3. `device_id`
- Ключ storage: `e2ee_device_id_<userId>`
- Формат: UUID string
- `lib/core/services/e2ee_service.dart:36`
- `lib/core/services/e2ee_service.dart:272`

4. Registration state
- Явного отдельного флага registration state в mobile-коде нет.
- Наличие local key material определяется через `hasLocalKeyMaterial`.
- `lib/core/services/e2ee_service.dart:311`

5. `master password-derived material`
- Не сохраняется как отдельная сущность в storage.
- Derive выполняется в памяти при backup create/restore.
- `lib/core/services/e2ee_service.dart:879`
- `lib/core/services/e2ee_service.dart:933`

6. `backup blob`
- Локально не сохраняется в отдельном persistent store.
- Создаётся в памяти и отправляется в backend `/e2ee/backup`.
- `lib/core/services/e2ee_service.dart:889`
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:72`

7. `backup metadata`
- Локально отдельного хранилища backup metadata нет.
- Метаданные читаются/пишутся через backend record.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:79`
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:134`

8. `encrypted message cache`
- Отдельного E2EE encrypted cache слоя в сервисе нет.
- Есть только runtime `_publicKeyCache` для public keys пользователей.
- `lib/core/services/e2ee_service.dart:39`

9. Session tokens
- В `AuthStorage` (детали реализации не в этом файле), влияют косвенно как bearer token для E2EE API.
- Использование токенов для E2EE endpoint calls подтверждено.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:19`

### 3.2 Безопасность хранения

1. Используется `flutter_secure_storage` (платформенный secure storage abstraction).
- `lib/core/services/e2ee_service.dart:3`

2. В коде нет platform-specific ветвления Android/iOS для E2EE storage.
- Явных вызовов `Keychain/Keystore/Secure Enclave` напрямую в E2EE коде нет.
- Mobile-код полагается на abstraction `FlutterSecureStorage`.

3. Что переживает logout:
- E2EE ключи не удаляются при logout в `AuthController`; удаляются только токены/сессионные данные.
- `lib/features/auth/presentation/logic/auth_controller.dart:480`
- `lib/features/auth/presentation/logic/auth_controller.dart:490`

4. Что переживает reinstall:
- В mobile-коде это не определено явно.
- Поведение зависит от платформенных свойств secure storage и политики ОС.

---

## 4. Master Password Semantics

### 4.1 Когда появляется и как используется

1. В password login master password берётся из `login(... password ...)` и передаётся в `_initE2EE(masterPassword: password)`.
- `lib/features/auth/presentation/logic/auth_controller.dart:219`
- `lib/features/auth/presentation/logic/auth_controller.dart:272`

2. В PIN login `_initE2EE()` вызывается без master password.
- `lib/features/auth/presentation/logic/auth_controller.dart:375`

3. Mobile сам не генерирует отдельный master password.
- Используется введённый пароль логина как вход в backup KDF flow.

### 4.2 Отправляется ли master password на backend

1. В E2EE backup endpoints master password не отправляется.
- В `uploadBackup` отправляются только encrypted payload и metadata.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:78`

2. В auth/login пароль уходит в backend как часть auth-контракта (не E2EE endpoint).
- Это outside чистого E2EE API.

### 4.3 Что derivеится

1. Derive: `derivedKey = PBKDF2-HMAC-SHA256(iter=120000, bits=256, salt=<16 bytes>)`
- `lib/core/services/e2ee_service.dart:18`
- `lib/core/services/e2ee_service.dart:873`
- `lib/core/services/e2ee_service.dart:879`

2. Derived key используется как AES-GCM ключ для шифрования/дешифрования private key backup payload.
- `lib/core/services/e2ee_service.dart:884`
- `lib/core/services/e2ee_service.dart:938`

3. Прямая восстановимость identity по master password возможна только при наличии корректного backup blob + metadata.
- `restoreKeysFromBackup` требует remote backup record.
- `lib/core/services/e2ee_service.dart:913`

### 4.4 Режимы

1. `restore-first` (password login, нет local key material): master password участвует.
- `lib/features/auth/presentation/logic/auth_controller.dart:131`

2. `fresh-key` fallback: master password может не участвовать в генерации ключей; участвует позже только если создаётся backup.
- `lib/features/auth/presentation/logic/auth_controller.dart:147`
- `lib/features/auth/presentation/logic/auth_controller.dart:150`

3. `QR linked-device`: master password не участвует в approve/history flow.
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:145`

---

## 5. Backup Creation Flow

### 5.1 Пошагово

1. Проверка контекста `_userId` и наличие private key в secure storage.
- `lib/core/services/e2ee_service.dart:863`
- `lib/core/services/e2ee_service.dart:867`

2. Декод private key из base64.
- `lib/core/services/e2ee_service.dart:872`

3. Генерация `salt`:
- `salt = nonce12 + first4bytes(another nonce12)` => 16 bytes.
- `lib/core/services/e2ee_service.dart:873`

4. Генерация `iv`:
- `iv = _cipher.newNonce()` => 12 bytes (для AES-GCM в cryptography package).
- `lib/core/services/e2ee_service.dart:877`

5. KDF:
- PBKDF2-HMAC-SHA256, iterations=120000, bits=256.
- `lib/core/services/e2ee_service.dart:18`

6. Encryption:
- AES-GCM-256, plaintext = raw private key bytes.
- output упаковывается как `base64(ciphertext + mac)`.
- `lib/core/services/e2ee_service.dart:884`
- `lib/core/services/e2ee_service.dart:889`

7. Upload backup metadata/payload на backend:
- `encrypted_private_key`, `salt`, `iv`, `kdf_algorithm='pbkdf2-sha256'`, `version=1`
- `lib/core/services/e2ee_service.dart:893`

### 5.2 Exact contract

Фактически отправляемый JSON в `/api/v1/e2ee/backup`:

```json
{
  "encrypted_private_key": "<base64(ciphertext||tag)>",
  "salt": "<base64(16_bytes)>",
  "iv": "<base64(12_bytes)>",
  "kdf_algorithm": "pbkdf2-sha256",
  "version": 1
}
```

Источник:
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:72`
- `lib/core/services/e2ee_service.dart:893`

### 5.3 Legacy/current comparison

| Aspect | Legacy | Current |
|---|---|---|
| Backup KDF contract | в mobile-коде не найдено других реально поддерживаемых backup KDF при restore | `pbkdf2-sha256` строго ожидается |
| Backup version migration | migration logic не найден в mobile-коде | `version` передаётся/читается как integer, но decision tree по version не реализован |
| Формат payload | `encrypted_private_key/salt/iv` | тот же набор полей |

Подтверждение:
- restore отклоняет любой `kdf_algorithm != pbkdf2-sha256`.
- `lib/core/services/e2ee_service.dart:917`

Примечание о потенциальной неоднозначности контракта:
- В datasource default аргумент `kdfAlgorithm = 'argon2id'`, но в фактическом create flow передаётся `'pbkdf2-sha256'`.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:67`
- `lib/core/services/e2ee_service.dart:898`

---

## 6. Backup Restore Flow

### 6.1 Пошагово

1. `getBackup(accessToken)`.
- `lib/core/services/e2ee_service.dart:913`

2. Если backup нет (`null`) -> ошибка `No remote backup found`.
- `lib/core/services/e2ee_service.dart:914`

3. Проверка `kdf_algorithm`.
- Если не `pbkdf2-sha256` -> исключение Unsupported backup kdf_algorithm.
- `lib/core/services/e2ee_service.dart:917`

4. Decode `salt`, `iv`, `encrypted_private_key`; проверка минимальной длины encrypted payload.
- `lib/core/services/e2ee_service.dart:923`
- `lib/core/services/e2ee_service.dart:926`

5. Derive key из master password и decrypt AES-GCM.
- `lib/core/services/e2ee_service.dart:933`
- `lib/core/services/e2ee_service.dart:938`

6. Восстановление key pair из seed/private bytes: `newKeyPairFromSeed(clear)`.
- `lib/core/services/e2ee_service.dart:943`

7. Сохранение private/public/device_id в secure storage.
- Device ID переиспользуется, если существует; иначе новый UUID.
- `lib/core/services/e2ee_service.dart:949`
- `lib/core/services/e2ee_service.dart:952`

8. Upload restored public key в `/e2ee/keys`.
- `lib/core/services/e2ee_service.dart:956`

9. Обновление runtime cache (`_userId`, `_cachedKeyPair`, `_cachedDeviceId`).
- `lib/core/services/e2ee_service.dart:962`

### 6.2 Ошибки

1. `master password mismatch`
- В коде нет явного кастомного типа этой ошибки.
- При mismatch ожидается cryptography decrypt exception из AES-GCM stage.
- `lib/core/services/e2ee_service.dart:938`

2. `malformed backup`
- Явно: `Invalid backup payload` при коротком `encrypted_private_key`.
- `lib/core/services/e2ee_service.dart:926`

3. `wrong contract metadata`
- Явно: unsupported `kdf_algorithm`.
- `lib/core/services/e2ee_service.dart:917`

4. `backend returned incomplete metadata`
- Отдельной валидации обязательности всех полей до decrypt нет;
- невалидность проявится decode/decrypt исключениями.

5. `legacy contract mismatch`
- Явно поддержка legacy backup contract в restore не найдена;
- fallback на другой kdf/version не реализован.

6. `unsupported backup format`
- Явно отражается в kdf check и потенциально decode/decrypt errors.

---

## 7. Device-to-Device Transfer and QR Flow

### 7.1 Фазы flow

1. `scan QR`:
- Mobile scanner считывает payload, парсит JSON/deeplink/base64url.
- `type` должен быть `web_pairing`.
- `pairing_id`, `qr_token`, `web_device_id`, `web_public_key` валидируются.
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart:52`
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart:663`
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart:699`
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart:653`

2. `preview`:
- `POST /e2ee/web/pairing/sessions/{pairingId}/preview` с `qr_token`.
- Mobile сверяет `web_device_id` и `web_public_key` из preview c QR-ожиданием.
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:56`
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:113`
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:123`

3. `approve`:
- `POST /.../approve` с `qr_token`, `web_device_id`, `web_public_key`, `device_name`, `platform='web'`, `history_sync=true`.
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:75`

4. Post-approve safety barrier:
- invalidate key cache;
- set post-approve required web device barrier;
- force refresh sender keys (best effort).
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:177`
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:178`
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:183`

5. `history sync`:
- После approve открывается `WebPairingHistorySyncPage`, который запускает `runHistorySync`.
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart:116`
- `lib/features/settings/presentation/pages/web_pairing_history_sync_page.dart:43`

6. `runHistorySync`:
- Собирает personal сообщения с keys,
- unwrap content key для текущего mobile device,
- wrap для web public key,
- отправляет batch в `/.../history`.
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:255`
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:355`
- `lib/features/settings/presentation/logic/linked_devices_controller.dart:372`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:113`

### 7.2 Что кодируется в QR

Поля `WebPairingQrPayload`:
- `pairing_id`, `qr_token`, `web_device_id`, `web_public_key`, `expires_at`, `type=web_pairing`.
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart:637`
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart:688`

### 7.3 Передаёт ли mobile identity key / историю / fan-out keys

1. Identity private key напрямую в QR flow не передаётся.
- В approve/syncHistory payload нет private key полей.
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:80`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:118`

2. История:
- Контент старых сообщений не отправляется.
- Отправляются re-wrapped message keys для web (`encrypted_key_for_web`) по message_id.
- `lib/features/settings/data/models/history_sync_models.dart:14`

3. Fan-out keys для старых сообщений:
- Да, через history sync items.

4. trusted/linked/approved marking:
- На mobile стороне явного локального trusted флага нет; mobile вызывает approve endpoint и затем читает `/e2ee/devices`.
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:126`

### 7.4 Redeem

- В mobile-коде вызов endpoint `redeem` не найден.
- Фаза redeem в текущей mobile реализации не подтверждена.

---

## 8. Message Encryption Flow

### 8.1 Пошагово

1. В personal chat перед отправкой формируется plaintext payload:
```json
{"text":"<content>","type":"<type>"}
```
- `lib/features/chat/presentation/pages/chat_detail_page.dart:3312`

2. Вызывается `encryptMessageHybrid(accessToken, payload, recipientUserId, senderUserId)`.
- `lib/features/chat/presentation/pages/chat_detail_page.dart:3314`

3. Генерируется одноразовый content key (AES-256).
- `lib/core/services/e2ee_service.dart:996`

4. Контент шифруется AES-GCM-256.
- Формат `content`: `base64(iv12 + ciphertext + tag16)`.
- `lib/core/services/e2ee_service.dart:1001`
- `lib/core/services/e2ee_service.dart:1007`

5. Список target devices:
- recipient devices из `/e2ee/keys/{recipient}`,
- sender devices из `/e2ee/keys/{sender}`,
- плюс форсированно текущий mobile device.
- `lib/core/services/e2ee_service.dart:1018`
- `lib/core/services/e2ee_service.dart:1023`
- `lib/core/services/e2ee_service.dart:1041`

6. Для каждого target device:
- ephemeral X25519,
- shared secret,
- HKDF-SHA256 outputLength=32,
- AES-GCM wrap content key,
- формат `keys[device_id] = base64(ephemeral_pub32 + key_iv12 + encrypted_key + tag16)`.
- `lib/core/services/e2ee_service.dart:1074`
- `lib/core/services/e2ee_service.dart:1084`
- `lib/core/services/e2ee_service.dart:1095`

7. Возвращается `{content, keys}`, затем `sendMessage` отправляет на backend.
- `lib/core/services/e2ee_service.dart:1121`
- `lib/features/chat/data/datasources/messages_remote_datasource.dart:28`

### 8.2 Post-QR barrier для first send

Если активен барьер после approve:
- cache invalidation + force refresh sender keys;
- обязательные проверки, что `requiredWebDeviceId` есть в senderDevices, allTargetDevices и финальном `keys`.
- `lib/core/services/e2ee_service.dart:985`
- `lib/core/services/e2ee_service.dart:1030`
- `lib/core/services/e2ee_service.dart:1052`
- `lib/core/services/e2ee_service.dart:1110`

---

## 9. Message Decryption Flow

### 9.1 Runtime decryption path

1. В incoming WS и history list personal сообщений mobile вызывает `decryptMessage`.
- `lib/features/chat/presentation/pages/chat_detail_page.dart:1160`
- `lib/features/chat/presentation/pages/chat_detail_page.dart:1927`

2. Передаётся `senderUserId`:
- для своих сообщений — current user id,
- для чужих — sender id.
- `lib/features/chat/presentation/pages/chat_detail_page.dart:1137`
- `lib/features/chat/presentation/pages/chat_detail_page.dart:1144`

3. `keys` берётся из `encrypted_keys` или `keys`.
- `lib/features/chat/presentation/pages/chat_detail_page.dart:1149`
- `lib/features/chat/data/models/message_model.dart:114`

### 9.2 Внутри `decryptMessage`

1. V4 (предпочтительно):
- читает `content` как raw binary envelope,
- ищет candidate device ids начиная с `_cachedDeviceId`,
- unwrap content key из `keys[device_id]`,
- decrypt content AES-GCM.
- `lib/core/services/e2ee_service.dart:506`
- `lib/core/services/e2ee_service.dart:510`
- `lib/core/services/e2ee_service.dart:564`
- `lib/core/services/e2ee_service.dart:578`

2. Fallback V3:
- поддерживается, если payload JSON с `v==3`.
- `lib/core/services/e2ee_service.dart:603`

3. Fallback V2:
- поддерживается, если payload JSON с `v==2`.
- `lib/core/services/e2ee_service.dart:703`

4. Fallback V1:
- поддерживается legacy JSON `{iv,ciphertext,mac}`.
- `lib/core/services/e2ee_service.dart:779`

### 9.3 Разница состояний

1. Есть backup, но нет fan-out envelope для device:
- restore backup не добавляет отсутствующий `keys[device_id]` для уже отправленного сообщения;
- без envelope decrypt этого сообщения невозможен.
- В коде это проявляется как `Encrypted for other device` / `Decryption failed`.
- `lib/core/services/e2ee_service.dart:606`
- `lib/core/services/e2ee_service.dart:716`

2. Нет backup:
- restore path выдаёт `No remote backup found`.
- `lib/core/services/e2ee_service.dart:915`

3. Есть backup, но decrypt backup не удался:
- decrypt exception на restore стадии; затем в login flow есть fallback на fresh initialize.
- `lib/features/auth/presentation/logic/auth_controller.dart:140`

4. Device registered as fresh device:
- `initialize` генерирует новый key pair и upload public key.
- `lib/core/services/e2ee_service.dart:279`

---

## 10. Mobile <-> Backend Contract

### 10.1 E2EE endpoints

1. `POST /api/v1/e2ee/keys`
- Когда: init/restore re-upload.
- Request поля:
```json
{ "device_id": "<string>", "public_key": "<base64>" }
```
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:17`

2. `GET /api/v1/e2ee/keys/{user_id}`
- Когда: fan-out targets, decrypt sender key lookup.
- Response ожидается: `{ "keys": { "device_id": "public_key_base64" } }`
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:43`
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:52`

3. `POST /api/v1/e2ee/backup`
- Когда: create backup.
- Request: `encrypted_private_key/salt/iv/kdf_algorithm/version`.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:72`

4. `GET /api/v1/e2ee/backup`
- Когда: restore / hasRemoteBackup.
- 204 => backup отсутствует.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:95`
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:105`

5. QR pairing endpoints:
- `POST /e2ee/web/pairing/sessions/{id}/preview`
- `POST /e2ee/web/pairing/sessions/{id}/approve`
- `POST /e2ee/web/pairing/sessions/{id}/reject`
- `POST /e2ee/web/pairing/sessions/{id}/history`
- `GET /e2ee/devices`
- `DELETE /e2ee/devices/{deviceId}`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:56`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:75`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:97`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:113`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:128`
- `lib/features/settings/data/datasources/web_pairing_remote_datasource.dart:144`

6. Message send/receive endpoint:
- `POST /conversations/{conversationId}/messages`
- body содержит `content`, `type`, optional `keys`, optional metadata fields.
- `lib/features/chat/data/datasources/messages_remote_datasource.dart:52`

### 10.2 Auth endpoints, влияющие на E2EE

- `auth/login` и PIN login формируют, будет ли доступен `masterPassword` для restore-first.
- В mobile-коде E2EE зависим от этого на уровне orchestration.
- `lib/features/auth/presentation/logic/auth_controller.dart:219`
- `lib/features/auth/presentation/logic/auth_controller.dart:323`

### 10.3 Legacy backup metadata expectation

- Mobile restore требует как минимум `encrypted_private_key`, `salt`, `iv`, `kdf_algorithm`.
- Если `kdf_algorithm != pbkdf2-sha256`, restore отклоняется.
- `lib/core/services/e2ee_service.dart:917`

---

## 11. Legacy Compatibility

### 11.1 Что есть в коде

1. Message decryption compatibility:
- V4 + V3 + V2 + V1 fallback в `decryptMessage`.
- `lib/core/services/e2ee_service.dart:506`
- `lib/core/services/e2ee_service.dart:603`
- `lib/core/services/e2ee_service.dart:703`
- `lib/core/services/e2ee_service.dart:779`

2. Backup compatibility:
- В restore поддержка только `pbkdf2-sha256`.
- Отдельной ветки legacy backup KDF/cipher не найдено.
- `lib/core/services/e2ee_service.dart:917`

### 11.2 Hardcoded assumptions

1. Message V4 binary layouts жёстко зафиксированы позициями байтов (32/12/16 и 12/16).
- `lib/core/services/e2ee_service.dart:522`
- `lib/core/services/e2ee_service.dart:553`

2. HKDF derive вызывается с пустым nonce (`[]`) и без отдельного info параметра в этом коде.
- `lib/core/services/e2ee_service.dart:537`
- `lib/core/services/e2ee_service.dart:1084`

3. Backup restore жёстко ожидает kdf string literal.
- `lib/core/services/e2ee_service.dart:917`

### 11.3 Риски рассогласования

1. Mobile vs backend по backup KDF:
- backend может вернуть `argon2id`, но mobile restore это не примет.
- datasource default также содержит `argon2id`, что усиливает риск конфигурационного рассогласования.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:67`
- `lib/core/services/e2ee_service.dart:917`

2. Mobile vs web по V4 packing:
- Любое расхождение по byte layout сломает decrypt.
- Mobile ожидает строго указанный порядок полей.

3. Migration decision tree для backup versions:
- в mobile-коде не найден.

---

## 12. Cross-Device Scenario Analysis

### 12.1 Сценарий: новый пользователь -> mobile -> web

1. User login on mobile:
- `_initE2EE(masterPassword=password)`.
- `lib/features/auth/presentation/logic/auth_controller.dart:272`

2. Mobile identity creation/restore:
- restore-first при отсутствии local keys,
- затем initialize (load/generate + upload key),
- затем optional backup create.
- `lib/features/auth/presentation/logic/auth_controller.dart:131`
- `lib/features/auth/presentation/logic/auth_controller.dart:147`
- `lib/features/auth/presentation/logic/auth_controller.dart:150`

3. Пользователь идёт на web и вводит master password.
- Поведение web в этом репозитории не реализовано.
- Ниже только mobile-side совместимость ожиданий.

### 12.2 Вариант A: backup успешно расшифровался

- Что произошло на mobile до этого:
1. Backup был создан в формате PBKDF2-SHA256 + AES-GCM.
2. `encrypted_private_key/salt/iv/kdf_algorithm/version` корректно записаны.

- Что ожидается от backend:
1. Вернуть тот же backup record без потери полей.
2. `kdf_algorithm = pbkdf2-sha256`.

- Что ожидается на web:
1. Совместимый KDF/cipher/packing для decrypt private key.

- Возможная несовместимость:
1. Если web ожидает другой KDF/формат backup payload.

### 12.3 Вариант B: backup есть, но не расшифровывается

- Mobile-side причины, подтверждённые кодом:
1. Неверный password -> decrypt fail.
2. kdf_algorithm mismatch -> restore reject.
3. malformed payload.

- Совместимость риск:
1. backend metadata mismatch,
2. backend/web/mobile используют разные KDF контракты.

### 12.4 Вариант C: backup не найден

- Mobile behavior:
1. `getBackup` -> 204/null,
2. login flow fallback на fresh key generation.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:105`
- `lib/features/auth/presentation/logic/auth_controller.dart:141`

- Cross-device implication:
1. Старые сообщения, зашифрованные на старые device keys, не будут доступны без history sync/переноса ключей.

---

## 13. Exact Source Map

### 13.1 Short-list критичных исходников

1. Key generation / identity lifecycle
- `lib/core/services/e2ee_service.dart`
- Критично: `initialize`, `_getPrivateKeyKey/_getPublicKeyKey/_getDeviceIdKey`.
- Линии: `197`, `34-36`.

2. Backup create
- `lib/core/services/e2ee_service.dart`
- Критично: `createAndUploadKeyBackup`.
- Линии: `859`.

3. Backup restore
- `lib/core/services/e2ee_service.dart`
- Критично: `restoreKeysFromBackup`.
- Линии: `908`.

4. Device registration/public key upload
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart`
- Критично: `uploadPublicKey`, `getUserKeys`.
- Линии: `10`, `37`.

5. QR flow
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart`
- Критично: `_onDetect`, `_approve`, `WebPairingQrPayload.tryParse`.
- Линии: `52`, `95`, `663`.

6. Approve + post-QR barrier
- `lib/features/settings/presentation/logic/linked_devices_controller.dart`
- Критично: `approvePairing`.
- Линии: `145`.

7. History sync
- `lib/features/settings/presentation/logic/linked_devices_controller.dart`
- Критично: `runHistorySync`, `_sendHistoryBatchWithRetry`.
- Линии: `255`, `486`.

8. Send message encryption
- `lib/features/chat/presentation/pages/chat_detail_page.dart`
- Критично: payload build + `encryptMessageHybrid` + send.
- Линии: `3312`, `3314`, `3340`.

9. Receive/history message decryption
- `lib/features/chat/presentation/pages/chat_detail_page.dart`
- Критично: WS decrypt + list decrypt.
- Линии: `1160`, `1927`.

10. Message model contract (`keys`/`encrypted_keys`)
- `lib/features/chat/data/models/message_model.dart`
- Критично: `keys: (json['encrypted_keys'] ?? json['keys'])`.
- Линия: `114`.

11. Message API payload contract
- `lib/features/chat/data/datasources/messages_remote_datasource.dart`
- Критично: `sendMessage` body fields including `keys`.
- Линии: `28-48`.

---

## 14. Known Risks and Open Questions

### 14.1 Подтверждено кодом

1. Current send path использует V4 binary envelope для `content` и `keys`.
2. Есть post-QR safety barrier для первого personal send после approve.
3. History sync реализован батчами с retry/backoff.
4. Backup restore поддерживает только `pbkdf2-sha256`.

### 14.2 Только предполагается / не подтверждено этим кодом

1. Web-side decrypt implementation и его точные KDF/cipher assumptions.
2. Backend eventual consistency window после approve.
3. Redeem endpoint usage в mobile.

### 14.3 Где mobile зависит от backend metadata correctness

1. `GET /e2ee/keys/{userId}` — корректный список device_id -> public_key.
2. `GET /e2ee/backup` — корректность `kdf_algorithm/salt/iv/encrypted_private_key`.
3. Pairing preview/approve consistency (`web_device_id`, `web_public_key`).

### 14.4 Возможные несовместимости mobile <-> web / backend

1. Backup KDF mismatch (`argon2id` vs `pbkdf2-sha256`).
2. Разный byte-level packing для V4 envelopes.
3. Разный base64 normalization/padding policy (mobile использует стандартный base64 encode/decode APIs).

### 14.5 Потенциальные баги/неоднозначности

1. В `WebPairingScanPage.dispose()` вызывается `widget.controller.dispose()`.
- При переиспользовании controller между экранами это может быть нежелательной жизненной цикловой связкой.
- `lib/features/settings/presentation/pages/web_pairing_scan_page.dart:48`

2. В `decryptMessage` есть признаки смешанного legacy слоя и техдолга (V2/V3 комментарии, сложные fallback ветки), что повышает риск регрессий при изменениях.
- `lib/core/services/e2ee_service.dart:705`

3. Для backup отсутствует migration decision tree по `version`.
- Поле `version` хранится/передаётся, но явной ветки поведения по version нет.
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:83`
- `lib/features/chat/data/datasources/e2ee_remote_datasource.dart:141`

---

## Sequence Diagram (Text)

### A) Login + E2EE init

1. `AuthController.login` получает токены.
2. `AuthController._initE2EE(masterPassword=password)`.
3. `E2EEService.hasLocalKeyMaterial`.
4. Если нет локальных ключей -> `restoreKeysFromBackup` (best effort).
5. `E2EEService.initialize` (load existing or generate new + upload public key).
6. Если password есть и backup отсутствует -> `createAndUploadKeyBackup`.

### B) QR linking + first send

1. Scan QR -> parse payload.
2. `previewPairing` -> preview mismatch checks.
3. `approvePairing` -> approve API call.
4. Set post-approve barrier + invalidate/refresh sender keys.
5. `runHistorySync` -> unwrap old keys + rewrap for web + batch upload.
6. First personal send -> `encryptMessageHybrid` enforces required web device in keys.

---

## Примеры JSON

### 1) Registration payload (device key publish)

```json
{
  "device_id": "3c3834f7-7f92-44ad-b2f2-4ddde5bd9fcd",
  "public_key": "<base64_x25519_public_key>"
}
```

Источник: `uploadPublicKey`.

### 2) Backup payload

```json
{
  "encrypted_private_key": "<base64(ciphertext||tag)>",
  "salt": "<base64_16_bytes>",
  "iv": "<base64_12_bytes>",
  "kdf_algorithm": "pbkdf2-sha256",
  "version": 1
}
```

Источник: `createAndUploadKeyBackup` + `uploadBackup`.

### 3) Encrypted personal message send payload

```json
{
  "content": "<base64(iv12+ciphertext+tag16)>",
  "type": "text",
  "keys": {
    "<device_id_1>": "<base64(ephemeral_pub32+key_iv12+enc_msg_key+tag16)>",
    "<device_id_2>": "<...>"
  },
  "reply_to_id": "<optional>",
  "content_hash": "<optional>",
  "metadata": "<optional>",
  "is_ephemeral": true,
  "ttl_seconds": 30
}
```

Источник: `chat_detail_page` + `MessagesRemoteDataSource.sendMessage`.

---

## Migration Decision Tree (по фактическому коду)

1. `old backup`
- Явного old-backup restore flow (кроме строгого `pbkdf2-sha256`) не найдено.

2. `current backup`
- Если `kdf_algorithm == pbkdf2-sha256` и payload корректен -> restore.

3. `no backup`
- restore бросает исключение -> login flow продолжает `initialize` и делает fresh keys.

4. `broken metadata`
- mismatch/invalid данные приводят к исключению -> fallback на fresh keys в login flow.

5. `QR fallback`
- QR flow независим от backup и может обеспечить доступ к истории через history sync rewrap.

---

## Итог

Текущая mobile реализация подтверждает:

1. Полноценный V4 send/decrypt flow с multi-device fan-out.
2. Реализованный linked-device QR flow с preview/approve/history.
3. Добавленный post-QR защитный барьер для первого нового сообщения.
4. Backup create/restore на PBKDF2-SHA256 + AES-GCM.

Ограничения текущего кода:

1. Backup legacy compatibility вне `pbkdf2-sha256` не реализована.
2. Redeem-фаза web pairing в mobile-коде не найдена.
3. Cross-platform storage details (конкретные Keychain/Keystore параметры) в E2EE коде явно не заданы.
