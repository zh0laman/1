# E2EE Frontend And Mobile Follow-Up After Web Device Ownership Fix

Актуально по состоянию на `2026-04-05`.

Этот документ нужен frontend и mobile команде после backend-фикса ownership для `web_device_id`.

## 1. Что backend теперь гарантирует

Backend теперь трактует один `web_device_id` как один browser slot с одним текущим owner.

Если тот же browser slot:

- логинится через `password + /e2ee/device/register`
- или проходит `QR approve`

backend перед trust/upsert делает cleanup stale state для этого же `web_device_id`:

- revoke old `user_public_keys` rows другого пользователя
- revoke old `web_pairing_sessions` для этого же browser slot

Практический смысл:

- один и тот же browser slot больше не должен одновременно выглядеть как active QR-linked device старого пользователя и trusted web device нового пользователя
- password login не должен наследовать stale QR-state
- для legacy `pbkdf2` compatibility backup ordinary `/e2ee/device/register` может теперь возвращать `has_backup = false`, даже если raw backup row физически существует в БД

Последний пункт сделан специально.

Backend больше не должен рекламировать legacy compatibility backup как deterministic password-restore path в обычном web bootstrap, потому что именно это зацикливало давних пользователей на broken restore flow вместо нормального `fresh web key`.

## 2. Что frontend web должен поправить

### 2.1 Не смешивать password flow и QR flow

Если пользователь вошел через `password + /e2ee/device/register`, frontend не должен считать это QR-linked flow.

Нельзя:

- запускать QR-specific polling/checks после обычного password login
- показывать QR-specific progress state без активного pairing session
- переиспользовать старый `pairing_id`, `session_token` или `qr_payload`

### 2.2 Чистить локальный QR state после смены аккаунта

При logout, account switch или fresh password login нужно очищать локальный state, связанный с QR pairing:

- `pairing_id`
- `session_token`
- `qr_token`
- `qr_payload`
- любые локальные флаги `awaiting_approve`, `approved`, `post_qr_check_pending`

Если этого не сделать, новый пользователь в том же browser slot может унаследовать чужой QR-local state.

### 2.3 Не переиспользовать QR intent после password register

После успешного `POST /api/v1/e2ee/device/register` frontend должен считать password bootstrap завершенным flow.

Если backend вернул `has_backup = false`, это не всегда означает "backup в БД физически отсутствует".

Для legacy compatibility users это теперь может означать:

- ordinary password restore intentionally suppressed
- продолжать нужно с `fresh web key`
- если нужна старая история, запускать отдельный `QR` flow

Дальше допустимы только:

- обычная работа с новыми сообщениями
- optional prompt для recovery backup
- optional отдельный QR flow, если реально нужна старая история

Но это должен быть новый QR flow, созданный заново, а не продолжение старого.

## 3. Что mobile должен поправить

### 3.1 Не запускать `Post-QR check` для password-login устройства

Проверка вида `Post-QR check failed: sender keys do not contain approved web device` должна выполняться только если mobile действительно находится в активном QR pairing flow.

Минимальные условия для такого check:

- есть текущий `pairing_id`
- этот `pairing_id` принадлежит текущему `user_id`
- mobile только что сделал `approve` именно для этого pairing
- check относится к тому же `web_device_id`

Если web вошел просто через password login, mobile не должен применять QR-only invariant к такому устройству.

### 3.2 Привязывать QR state не только к `web_device_id`

Local mobile state для QR pairing нельзя ключевать только по `web_device_id`.

Нужно ключевать минимум по:

- `user_id`
- `pairing_id`
- `web_device_id`

Иначе один и тот же browser slot после logout/login другого пользователя может ошибочно считаться “тем же самым approved web device”.

### 3.3 Сбрасывать stale QR session state

После завершения pairing flow mobile должен очищать локальный QR state:

- после `redeem`
- после `revoke`
- после `expired`
- после account switch
- после logout

Иначе stale local approve-state может пережить смену пользователя и ломать последующие sends.

### 3.4 Разделить две разные гарантии

Mobile должен разделять:

- `password login web device is trusted for new messages`
- `QR linked device may receive old history after history sync`

Это разные гарантии.

Нельзя требовать QR-specific approval для каждого password-registered web device.

## 4. Общая продуктовая политика

Правильная модель такая:

- `password login` сам по себе разрешен и достаточен для обычного входа
- после password login пользователь получает security notification / push
- для новых сообщений достаточно trusted web device после `/e2ee/device/register`
- QR нужен не для самого login, а для linked-device trust transfer и old history
- старая история открывается через restored identity key или через `QR + history sync`

## 5. Checklist для команд

### Frontend web

- убрать автоматическое продолжение stale QR flow после password login
- очищать QR-local state при logout/account switch
- не запускать QR polling/checks без нового pairing session

### Mobile

- запускать `Post-QR check` только внутри активного QR flow
- хранить QR-local state с ключом `user_id + pairing_id + web_device_id`
- очищать stale QR state после завершения flow и при смене аккаунта
- не трактовать password-registered web как QR-approved device по умолчанию
