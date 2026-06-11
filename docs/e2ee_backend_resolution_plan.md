# E2EE Backend Resolution Plan

Актуально по состоянию на `2026-04-05`.

Этот документ нужен backend-команде как точное описание текущего архитектурного разрыва в web E2EE flow и как список того, что необходимо зафиксировать, чтобы frontend и backend работали детерминированно и без криптографических догадок.

## 1. Короткий вывод

Текущий backend уже исправил старую проблему с KDF:

- `kdf_algorithm` возвращается
- `kdf_params` возвращаются
- для legacy `pbkdf2-sha256` version `1` делается backfill

Это хорошо и правильно.

Но система все еще не является полностью определенной, потому что backend пока не фиксирует:

- какой exact key type лежит в backup
- какой exact key format лежит в backup
- можно ли restored private key использовать как identity нового web device
- какой exact flow считается canonical для доступа к старой истории

Из-за этого frontend вынужден принимать решения, которых backend formally не специфицировал.

## 2. Что backend уже делает правильно

### 2.1 Backup остается client-side encrypted

Backend не видит master password и не расшифровывает private key.

Это правильная модель для E2EE.

### 2.2 KDF contract уже нормализован

Сейчас backend:

- нормализует `kdf_algorithm`
- нормализует `kdf_params`
- делает legacy backfill для `pbkdf2-sha256`

Это уже закрывает проблему "frontend не знает KDF settings".

### 2.3 `204 No Content` для отсутствующего backup

Это правильный ответ для сценария "backup еще не создан".

### 2.4 `public_key` и `device_id` сохраняются для web device registration

Текущий `/e2ee/device/register` уже решает session bootstrap и привязку текущего браузера как linked web device.

## 3. Что сейчас не зафиксировано

### 3.1 Не зафиксирован backup plaintext contract

В модели `UserKeyBackup` backend хранит:

- `encrypted_private_key`
- `salt`
- `iv`
- `kdf_algorithm`
- `kdf_params`
- `version`

Но backend не фиксирует:

- это private key какого типа
- в каком формате он serialized перед AES-GCM
- должен ли он потом импортироваться как `X25519`, `P-256`, `raw`, `pkcs8`, `jwk` и т.д.

Это главный remaining blocker.

### 3.2 Не зафиксирован device identity scope

Сейчас не определено:

- backup относится к device recovery
- backup относится к user identity recovery
- backup может использоваться для web onboarding
- backup нельзя использовать для web onboarding без QR

Пока не будет ответа на этот вопрос, frontend не может правильно решить, что именно делать после restore.

### 3.3 `public_key` хранится как opaque string

Для текущей стадии разработки это удобно, но в production это опасно.

Сейчас backend фактически не гарантирует:

- что `public_key` это `X25519`
- что у всех устройств одинаковый crypto profile
- что messaging flow действительно совместим между mobile и web

## 4. Где конфликт в документации

Сейчас backend docs содержат логический конфликт.

### 4.1 Один документ говорит: web это отдельное устройство

`docs/e2ee_mobile_web_client_guide.md` задает модель:

- `device identity key = X25519`
- у каждого устройства свой собственный keypair
- нельзя использовать один и тот же private key на mobile и web

Это правильная и современная multi-device модель.

### 4.2 Другой документ говорит: web может восстановить старый private key и зарегистрироваться с ним

`docs/E2EE_WEB_LOGIN_GUIDE.md` описывает flow:

- `GET /e2ee/backup`
- decrypt backup
- derive `public_key`
- `POST /e2ee/device/register` с этим `public_key`

Это уже другая модель.

### 4.3 Architecture doc говорит: одного backup недостаточно

`docs/e2ee_web_pairing_architecture.md` прямо объясняет:

- старые сообщения привязаны к `encrypted_keys[device_id]`
- новый `web_device_id` не увидит старую историю только потому, что у него появился private key
- нужен `history sync / re-wrap` или перенос старой identity

Это конфликтует с упрощенным смыслом restore flow из web login guide.

## 5. Что backend должен решить архитектурно

Команда должна выбрать одну canonical модель.

### Рекомендуемая модель

Рекомендуется принять такую схему:

- web = отдельное устройство
- у web всегда свой собственный `X25519 keypair`
- `web_device_id` стабилен для browser slot
- `public_key` web всегда `X25519`
- backup нужен для recovery, но не заменяет history sync
- доступ к старой истории для нового web обеспечивается через `QR + history re-wrap`

Эта модель:

- совпадает с current mobile/web crypto guide
- совпадает с current frontend `chatCrypto`
- совпадает с architecture doc
- минимизирует двусмысленность

## 6. Что backend должен явно добавить в contract

### 6.1 Backup metadata

В ответе `GET /e2ee/backup` должны быть явно описаны:

- `backup_key_type`
  - example: `x25519`
- `backup_key_format`
  - example: `pkcs8-der-base64`
- `backup_key_scope`
  - example: `device_identity`
  - or `user_recovery_material`
- `cipher_algorithm`
  - example: `aes-256-gcm`
- `cipher_tag_embedded`
  - `true/false`
- `aad_mode`
  - `none` or exact value
- `password_processing`
  - example: `utf8-raw`

Минимальный must-have набор:

- `backup_key_type`
- `backup_key_format`
- `backup_key_scope`

### 6.2 Public key validation

Для новых регистраций backend должен валидировать:

- соответствует ли `public_key` выбранному canonical profile
- корректна ли длина
- корректен ли формат base64

Это можно включить:

- только для новых backup version / client version
- с backward compatibility для legacy records

## 7. Что backend должен сделать для legacy

### 7.1 Ввести явную versioned migration strategy

Сейчас `version = 1` используется слишком широко и не несет полного смысла.

Нужно разделить:

- backup schema version
- backup key format version
- crypto profile version

Или как минимум:

- `backup_format_version`

### 7.2 Добавить fixture

Нужен один deterministic fixture:

- `master_password`
- `salt`
- `iv`
- `encrypted_private_key`
- `kdf_algorithm`
- `kdf_params`
- `backup_key_type`
- `backup_key_format`
- expected `public_key`

Без этого обе команды будут продолжать спорить о том, где именно ломается restore.

### 7.3 Определить legacy compatibility policy

Команда должна явно решить:

- legacy backup еще поддерживаем
- legacy backup поддерживаем только read-only
- legacy backup нужно мигрировать при следующем логине
- legacy backup без определенного format id считается unsupported

## 8. Что backend должен определить по web history

Если выбрана рекомендуемая модель `web = отдельное устройство`, backend должен официально закрепить:

- password login quick-start не гарантирует доступ к старой истории
- access to old history для нового `web_device_id` делается через `history sync / re-wrap`
- backup сам по себе не означает "история доступна"

Это очень важно для продукта и для UI.

Иначе frontend будет обещать пользователю невозможное.

## 9. Что backend должен определить по password-based restore

Если бизнес хочет сохранить flow "ввести master password и без QR получить старую историю", то backend обязан определить exact semantics.

Нужно ответить на вопрос:

- что именно означает backup restore в password login flow

Допустимые варианты только два:

### Вариант A. Restore = восстановление старой identity

Тогда backend должен официально разрешить:

- перенос одного и того же private identity material на новый `web_device_id`

И тогда backend docs должны прямо сказать:

- да, в этом продукте web может использовать restored old private key
- да, это допустимо с точки зрения security model

### Вариант B. Restore != full history restore

Тогда backend должен прямо сказать:

- password-based restore не гарантирует старую историю
- canonical history restore only via QR + re-wrap

С архитектурной точки зрения это более безопасный и понятный вариант.

## 10. Что backend должен сделать в документации

Сейчас docs нужно свести к одной версии.

Нужно:

1. Обновить `docs/E2EE_WEB_LOGIN_GUIDE.md`
2. Обновить `docs/e2ee_mobile_web_client_guide.md`
3. Обновить `docs/e2ee_web_pairing_architecture.md`
4. Убрать противоречия между ними
5. Добавить один final canonical section:
   - `Canonical crypto profile`
   - `Canonical backup format`
   - `Canonical web history model`

## 11. Acceptance criteria для backend

Backend можно считать доведенным до production-ready состояния, если выполняются все условия ниже.

### 11.1 Backup contract

- `GET /e2ee/backup` отдает полный deterministic contract
- contract включает key type/format/scope
- legacy handling versioned и explicit

### 11.2 Public key model

- `public_key` format определен
- для новых устройств есть validation
- mobile и web используют один canonical device crypto profile

### 11.3 History model

- четко определено, когда доступна старая история
- четко определено, нужен ли `history re-wrap`
- password flow и QR flow не противоречат друг другу

### 11.4 Team validation

- есть один shared test vector
- frontend и backend сверили expected `public_key`
- хотя бы один end-to-end сценарий documented и reproducible

## 12. Практическая рекомендация

Самый безопасный и понятный для проекта путь:

1. Официально выбрать `X25519` как единственный canonical device key type.
2. Официально выбрать один backup key format.
3. Считать web отдельным устройством.
4. Password login использовать для quick-start и новых сообщений.
5. Старую историю для нового web открывать через `QR + history sync / re-wrap`.
6. Legacy backup поддерживать только через explicit format metadata и fixture.

## 13. Итог

Текущая backend проблема уже не в endpoint-ах и не в KDF.

Текущая backend проблема в том, что:

- backup format недоопределен
- identity model недоопределена
- docs расходятся между собой

Пока эти вещи не сведены в один final contract, frontend не сможет быть строго детерминированным и будет вынужден гадать в криптографически чувствительном месте.

Следующий обязательный шаг для backend-команды:

1. выбрать одну canonical identity model
2. зафиксировать exact backup key contract
3. добавить versioned metadata
4. выпустить один deterministic fixture
5. синхронизировать docs под одну модель

