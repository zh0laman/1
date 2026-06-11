# E2EE Frontend Resolution Plan

Актуально по состоянию на `2026-04-05`.

Этот документ нужен frontend-команде как итоговый разбор текущей проблемы с web login + E2EE backup restore и как список того, что должно быть реализовано, чтобы flow работал стабильно и предсказуемо.

## 1. Короткий вывод

Текущая проблема frontend уже не в `PBKDF2` и не в `kdf_params`.

`GET /e2ee/backup` теперь отдает достаточный KDF contract для `pbkdf2-sha256`, и frontend уже умеет его использовать.

Оставшийся блокер в другом:

- не зафиксирован один канонический формат private key внутри backup
- не зафиксирована одна каноническая модель device identity для web
- разные backend docs описывают разные сценарии

Из-за этого frontend сейчас делает предположение:

- после decrypt backup должен получиться `X25519 private key`
- из него можно вывести `X25519 public key`
- этот `public_key` можно зарегистрировать на новый `web_device_id`

Это предположение логично, но сейчас не гарантировано backend contract-ом.

## 2. Что уже работает

На frontend уже реализованы правильные базовые шаги:

- `POST /auth/login` используется только как bootstrap login
- после логина всегда вызывается `POST /e2ee/device/register`
- canonical web session tokens берутся из `/e2ee/device/register`
- для backup restore frontend берет `kdf_algorithm` и `kdf_params` из backend response
- frontend больше не подбирает legacy `pbkdf2` параметры наугад
- `web_device_id` хранится стабильно
- private key хранится локально в `IndexedDB`
- websocket и chat requests используют `web_device_id`

Текущие ключевые frontend файлы:

- `src/application/use-cases/auth/PasswordLoginWithE2eeBootstrapUseCase.ts`
- `src/shared/utils/e2eeBackupCrypto.ts`
- `src/shared/utils/e2eeDeviceCrypto.ts`
- `src/shared/utils/chatCrypto.ts`
- `src/presentation/pages/auth/LoginPage.tsx`
- `src/presentation/components/messenger/utils.ts`

## 3. Что подтверждено по коду frontend

### 3.1 Restore flow сейчас жестко ожидает X25519

Frontend после decrypt backup делает следующее:

- пытается нормализовать plaintext как private key
- пытается импортировать его как `X25519`
- потом получает `public_key` из этого private key

Это видно в:

- `src/shared/utils/e2eeDeviceCrypto.ts`
- `src/shared/utils/e2eeBackupCrypto.ts`

То есть сейчас frontend поддерживает только такой сценарий:

- backup plaintext = `X25519 private key`

Если legacy backup был создан в другом формате, restore не пройдет.

### 3.2 Chat encryption/decryption тоже жестко на X25519

Текущий chat crypto flow работает только с `X25519`:

- импорт public key как `X25519`
- import private key как `X25519`
- wrapping key через `X25519 + HKDF + AES-GCM`

Это значит, что даже если backend исторически принимал любой `public_key` как строку, текущий frontend реально совместим только с `X25519`.

### 3.3 История читается только по текущему device_id

Frontend для каждого сообщения берет:

- `encrypted_keys[currentDeviceId]`

Если записи для текущего `web_device_id` нет, сообщение считается недоступным.

Это важно:

- одного backup недостаточно для полной гарантии доступа к старой истории
- для нового `web_device_id` нужен либо перенос старой identity
- либо `history sync / re-wrap`

## 4. Где именно сейчас риск

Основной риск разделяется на два уровня.

### 4.1 Риск №1: backup plaintext format не определен

Frontend не знает, что именно должно получиться после decrypt:

- `X25519 pkcs8`
- `X25519 raw 32`
- `P-256 pkcs8`
- base64-string от ключа
- другой legacy формат

Сейчас frontend предполагает `X25519`.

Если backend/mobile исторически использовали другой формат, пользователь увидит ошибку restore, даже если `master password` правильный.

### 4.2 Риск №2: identity model не определена

Сейчас документы backend описывают две несовместимые идеи:

- web это отдельное устройство со своим собственным keypair
- web может восстановить старый private key и зарегистрировать новый `web_device_id` уже с ним

Пока команда не выберет одну из этих моделей, frontend не может быть "100% правильным" по определению.

## 5. Как frontend должен вести себя уже сейчас

До окончательной фиксации backend contract frontend должен использовать следующие правила.

### 5.1 Если `GET /e2ee/backup` вернул `204`

Frontend должен:

- перейти в quick-start flow
- сгенерировать новый `X25519 keypair`
- зарегистрировать `public_key` на текущий `web_device_id`

Это корректный и безопасный сценарий.

### 5.2 Если backup есть, но restore не удался

Frontend не должен:

- молча генерировать новый ключ
- делать вид, что старая история восстановлена

Frontend должен:

- показать понятную ошибку
- предложить повторить ввод master password
- предложить войти как новое web-устройство без старой истории

### 5.3 Если restore удался, но для сообщений нет `encrypted_keys[currentDeviceId]`

Frontend должен явно показать, что:

- ключ восстановлен локально
- но старая история для этого `web_device_id` не синхронизирована
- нужен `history sync / re-wrap` или QR linked-device flow

Нельзя обещать пользователю "история восстановлена", если на самом деле восстановился только private key blob.

## 6. Что frontend еще должен доделать

### 6.1 Разделить ошибки restore на отдельные состояния

Сейчас сообщение об ошибке restore слишком общее.

Нужно разделить хотя бы на такие состояния:

- `unsupported_backup_kdf`
- `unsupported_legacy_backup`
- `backup_decrypt_failed`
- `unsupported_private_key_format`
- `restored_key_not_compatible_with_current_web_crypto_profile`
- `history_sync_required`

Это сильно упростит диагностику.

### 6.2 Не смешивать "backup restore" и "history restored"

В UI надо различать:

- `backup decrypted successfully`
- `current web device can decrypt old messages`

Это не одно и то же.

### 6.3 Явно считать QR flow основным способом полноценного history restore

До тех пор пока backend не зафиксирует, что password-based backup restore переносит старую identity корректно, frontend должен считать:

- password login + restore = best-effort backup recovery
- QR linked-device + history sync = canonical full history restore

## 7. Что frontend обязательно должен получить от backend

Чтобы убрать остаточную неопределенность, frontend нужен следующий backend contract.

### 7.1 Поля backup format

Backend должен отдавать:

- `backup_key_type`
- `backup_key_format`
- `backup_key_scope`
- `cipher_algorithm`
- `cipher_tag_embedded`
- `aad_mode`
- `password_processing`

Минимально достаточно хотя бы:

- `backup_key_type`
- `backup_key_format`
- `backup_key_scope`

### 7.2 Один test vector

Frontend нужен один рабочий fixture:

- `master_password`
- `salt`
- `iv`
- `encrypted_private_key`
- `kdf_algorithm`
- `kdf_params`
- expected decrypted format
- expected `public_key`

Без этого крипто-совместимость нельзя считать доказанной.

## 8. Рекомендуемая модель для frontend

Рекомендуется принять следующую рабочую модель.

### 8.1 Web это отдельное устройство

То есть:

- у web свой `web_device_id`
- у web свой `X25519 keypair`
- backend хранит `public_key` именно web-устройства

### 8.2 Старую историю открывает не backup сам по себе, а history sync

То есть:

- backup может помочь восстановить ключевой материал
- но доступ к старым сообщениям для нового `web_device_id` должен гарантироваться через `history re-wrap`

### 8.3 Password flow и QR flow должны быть честно разделены

Рекомендуемая продуктовая логика:

- password login = быстрый вход + новые сообщения
- QR linked-device = полноценное подключение web как доверенного устройства + старая история

Если бизнес все же требует full restore через master password без QR, тогда backend обязан сначала зафиксировать exact identity model.

## 9. Acceptance criteria для frontend

Frontend можно считать доведенным до production-ready состояния, если выполняются все условия ниже.

### 9.1 Login/bootstrap

- после `/auth/login` всегда вызывается `/e2ee/device/register`
- используются только linked-device tokens из `/e2ee/device/register`
- `web_device_id` стабилен между сессиями

### 9.2 Backup restore

- `kdf_params` никогда не угадываются
- ошибки restore разделены по типам
- при restore failure нет silent fallback на новый ключ

### 9.3 Messaging

- шифрование новых сообщений работает только по `X25519` profile
- дешифровка сообщений завязана на `currentDeviceId`
- отсутствие `encrypted_keys[currentDeviceId]` показывает понятную причину

### 9.4 UX

- пользователь понимает разницу между:
  - "новый вход без старой истории"
  - "backup удалось расшифровать"
  - "старая история реально доступна"

## 10. Итог

Frontend сейчас уже находится близко к правильному состоянию.

Главное, что еще нельзя считать закрытым:

- format of decrypted backup private key
- exact meaning of password-based history restore
- relationship between restored key and new `web_device_id`

Пока backend не зафиксирует эти три вещи, frontend может быть только "разумно совместимым", но не "строго детерминированным".

Поэтому следующий обязательный шаг для команды:

1. backend фиксирует один canonical crypto contract
2. frontend подгоняет restore/import flow под этот contract
3. обе команды проверяют один shared fixture end-to-end

