# E2EE Legacy Restore Root Cause And Actions For Backend

Актуально по состоянию на `2026-04-05`.

Этот документ нужен backend/mobile команде как финальное объяснение:

- что уже проверено не по догадкам, а по реальному коду и runtime
- где именно находится remaining blocker
- почему это уже не frontend bug
- что именно нужно сделать на backend/mobile стороне, чтобы ordinary password login с recovery backup работал детерминированно

---

## 1. Короткий итог

Сейчас основной E2EE flow уже подтвержден как рабочий:

- ordinary login работает
- linked-device QR flow работает
- через QR старая история на web реально открывается
- frontend умеет читать current backup contract
- frontend умеет `backup_key_format = pkcs8-der-base64`
- frontend умеет `backup_key_format = raw-32-bytes`

Remaining blocker остался только в одном месте:

- `password login + recovery backup restore` для legacy backup

И этот blocker уже не находится во frontend import logic.

По текущему runtime кейсу decrypt падает еще на шаге `AES-GCM decrypt`, до импорта private key.

Это значит:

- либо пользователь вводит не тот `E2EE master password`
- либо legacy backup был исторически создан по другому crypto contract, чем backend сейчас backfill'ит и отдает через API

---

## 2. Что уже доказано

### 2.1 Ordinary login не сломан

`POST /auth/login` проходит успешно.

Это означает:

- обычный пароль пользователя валиден
- auth/session flow работает
- проблема не в login UI и не в bootstrap auth

### 2.2 QR linked-device flow работает

Runtime проверка показала:

- `POST /api/v1/web/pairing/sessions` создает pairing session
- `POST /api/v1/web/pairing/sessions/{pairing_id}/redeem` выдает linked-device токены
- `GET /api/v1/auth/me` с этими токенами проходит
- самое важное: после QR входа старая история на web видна

Это критический факт.

Он означает:

- backend history sync path работает
- `messages.encrypted_keys[current_web_device_id]` для старой истории реально появляются
- web decrypt chat messages работает
- основная E2EE chat model не сломана

Следовательно, remaining bug изолирован только в password-based recovery restore.

### 2.3 Frontend уже поддерживает оба backup format

На frontend уже реализовано:

- decrypt по backend-declared `kdf_algorithm + kdf_params`
- import `pkcs8-der-base64`
- import `raw-32-bytes`
- отдельная обработка decrypt failure и format mismatch

Это важно, потому что текущая ошибка больше не маскирует import failure как wrong password.

---

## 3. Что показал backend код

### 3.1 Backend не расшифровывает backup и не знает master password

Код backend подтверждает:

- сервер хранит encrypted blob
- сервер не получает plaintext private key
- сервер не получает master password
- сервер не может сам cryptographically доказать, что legacy backup сегодня расшифровывается current contract'ом

Ключевые места:

- `internal/repository/e2ee_repository.go`
- `internal/service/e2ee_service.go`
- `internal/handler/e2ee_handler.go`

### 3.2 Current API contract для backup собирается через normalize/backfill/inference

Это главный технический момент.

На чтении backend не просто возвращает строку из таблицы как есть. Он еще делает:

- нормализацию metadata
- legacy backfill KDF params
- inference `backup_key_format`

Ключевые места:

- `internal/service/e2ee_service.go`
- `internal/service/e2ee_contract.go`

### 3.3 Legacy `pbkdf2` KDF params backfill'ятся post factum

Для legacy `pbkdf2-sha256` version `1` backend сейчас добавляет:

- `iterations = 310000`
- `hash = sha256`
- `key_length = 32`

Это делается:

- миграцией `db/migrations/20260405113000_add_kdf_params_to_user_key_backups.sql`
- и runtime merge'ом в `inferredLegacyKDFParams`

То есть это не обязательно original historical contract. Это deterministic compatibility assumption.

### 3.4 `raw-32-bytes` для legacy backup определяется эвристикой

В `inferLegacyBackupKeyFormat` backend делает вывод:

- если `kdf_algorithm` похож на `pbkdf2`
- если `version = 1`
- если длина decoded ciphertext равна `32 + 16`
- тогда считать format как `raw-32-bytes`

Это разумная эвристика, но это не доказательство полного original contract.

Ключевое место:

- `internal/service/e2ee_contract.go`

### 3.5 Собственные backend тесты подтверждают именно compatibility inference

Особенно важны тесты:

- `TestSaveKeyBackup_FillsLegacyPBKDF2ParamsWhenMissing`
- `TestGetKeyBackup_FillsLegacyPBKDF2ParamsWhenMissing`
- `TestSaveKeyBackup_InfersLegacyRawBackupFormatFromCiphertextLength`
- `TestGetKeyBackup_OverridesBackfilledPKCS8WhenLegacyCiphertextLooksRaw`
- `TestRegisterWebDevice_BackupIncludesInferredLegacyKDFParams`

Они подтверждают, что current backend behavior для legacy backup это:

- backfill
- override
- inference

А не end-to-end decrypt proof реального старого backup.

Ключевое место:

- `internal/service/e2ee_web_service_test.go`

---

## 4. Что показала база данных и CSV выгрузка

Проверка таблицы `user_key_backups` дала еще одно важное доказательство.

Дополнительно CSV выгрузка `data-1775411437154.csv` показала, что в проверенной выборке все `53` записи лежат с одним и тем же metadata profile:

- `backup_key_format = pkcs8-der-base64`
- `backup_key_scope = device_identity`
- `kdf_algorithm = pbkdf2-sha256`
- `cipher_algorithm = aes-256-gcm`
- `password_processing = utf8-raw`

Это важно интерпретировать правильно.

CSV доказывает, что в базе сейчас хранится унифицированный backfilled profile для legacy backup.

Но CSV сам по себе не доказывает, что именно такой contract использовался исторически при создании каждого old backup.

Для problem sample account в таблице лежит legacy record с:

- `user_id = 9`
- `created_at = 2026-02-27 04:29:28.564783+00`
- `kdf_algorithm = pbkdf2-sha256`
- `kdf_params = {"hash":"sha256","iterations":310000,"key_length":32}`
- `backup_key_type = x25519`
- `backup_key_format = pkcs8-der-base64`
- `backup_key_scope = device_identity`
- `cipher_algorithm = aes-256-gcm`
- `password_processing = utf8-raw`

Но через runtime API backend для этого же account уже возвращал:

- `backup_key_format = raw-32-bytes`

Это очень важный сигнал.

Он означает:

- текущие legacy строки в `user_key_backups` нельзя считать криптографической истиной сами по себе
- база для old rows хранит compatibility metadata profile, а не доказанный original contract
- stored DB metadata уже не считается backend'ом окончательной истиной для legacy rows
- backend сам корректирует этот contract на чтении
- следовательно, значения в legacy DB row не являются доказанным historical format

Это напрямую подтверждает root cause:

- старые записи были созданы до появления explicit metadata
- позже metadata была частично дописана миграциями и runtime normalization
- current response может быть internally consistent, но still not equal to original client contract of that backup

---

## 5. Что показал runtime decrypt

Sample payload для account `user_id = 9` был воспроизведен локально по exact backend-declared contract:

- `pbkdf2-sha256`
- `iterations = 310000`
- `hash = sha256`
- `key_length = 32`
- `aes-256-gcm`
- `cipher_tag_embedded = true`
- `aad_mode = none`
- `password_processing = utf8-raw`
- `backup_key_format = raw-32-bytes`

Результат:

- `AES-GCM` authentication не проходит
- decrypt падает до шага import key

Это уже закрывает одну из предыдущих гипотез.

Проблема не в том, что frontend пытался импортировать legacy raw key как `pkcs8`.

Если бы проблема была только в format mismatch, тогда:

- decrypt прошел бы успешно
- а ошибка возникла бы позже, на этапе import/normalize private key

Но этого не происходит.

Значит remaining mismatch находится раньше:

- в password preprocessing
- или в KDF profile
- или в exact AES payload contract
- или в том, что historical legacy client в реальности шифровал не так, как backend сейчас объявляет

---

## 6. Почему это уже не frontend bug

С учетом всех проверок сейчас уже доказано следующее:

- ordinary auth flow работает
- QR linked-device flow работает
- old history через QR работает
- frontend читает backend-declared KDF contract
- frontend не угадывает `backup_key_format`
- frontend поддерживает `raw-32-bytes`
- frontend не продолжает restore с guessed key material
- ошибка теперь честно показывает decrypt failure, а не format mismatch

Следовательно, добавление еще одного guessing fallback на frontend:

- не сделает flow детерминированным
- только усугубит nondeterministic behavior
- создаст риск silent misuse of wrong identity key

То есть текущий blocker уже должен решаться не на frontend guessed logic, а на backend/mobile стороне через exact historical contract.

---

## 7. Наиболее вероятный root cause

На текущий момент наиболее вероятная причина такая:

- legacy backup `2026-02-27` был создан старым client implementation
- в тот момент полный explicit contract еще не сохранялся в БД
- позднее backend добавил metadata и KDF defaults через migrations
- затем runtime layer начал доопределять legacy format через inference
- resulting API response выглядит валидно, но не является криптографически доказанным original contract for this exact record

Простыми словами:

- backend сейчас отдает best-effort reconstructed contract
- а не guaranteed original contract этого legacy backup

---

## 8. Что нужно backend/mobile сделать

Перед деталями здесь важен один практический вывод.

Для legacy пользователей есть только два корректных пути:

- лучший путь: на trusted device, где старая история еще открывается, расшифровать old backup и пересохранить его заново в current canonical format
- если пересохранить нельзя: backend/mobile должны дать exact old contract или deterministic test vector

Без одного из этих двух путей password-based restore для старых записей нельзя считать deterministic.

### 8.1 Найти origin этого legacy backup

Нужно установить:

- какой exact client создал backup record
- mobile или старый web
- какой exact app version/commit path создавал backup
- какой code path использовался на дату `2026-02-27`

Без этого backend сейчас опирается только на inference.

### 8.2 Подтвердить exact password preprocessing

Нужно подтвердить, что historical client действительно делал:

- raw UTF-8 bytes
- без `trim`
- без Unicode normalization
- без lowercasing
- без pepper
- без любых дополнительных string transforms

Current `password_processing = utf8-raw` для legacy rows сейчас больше похоже на semantic declaration, чем на proven historical fact.

### 8.3 Подтвердить exact KDF profile

Нужно подтвердить:

- это точно `PBKDF2-HMAC-SHA256`
- exact `iterations`
- exact derived key length
- не было ли альтернативной legacy ветки с другим iteration count

### 8.4 Подтвердить exact AES-GCM payload contract

Нужно подтвердить:

- tag действительно embedded в ciphertext
- AAD действительно отсутствовал
- не было отдельного envelope
- не было client-side packaging differences до/после AES-GCM

### 8.5 Подтвердить exact plaintext contract

Даже если текущий fail происходит до import key, нужно все равно зафиксировать:

- plaintext действительно был raw `32-byte X25519 private key`
- а не другой 32-byte blob со своей внутренней семантикой

### 8.6 Дать deterministic test vector

Это лучший вариант.

Нужен один fixture:

- `master_password`
- `salt`
- `iv`
- `encrypted_private_key`
- `kdf_algorithm`
- `kdf_params`
- `backup_key_format`
- expected plaintext
- expected derived `public_key`

Пока такого vector нет, восстановление legacy compatibility остается предположением.

### 8.7 Если possible, пересохранить backup в canonical format

Если у пользователя есть trusted device, который еще умеет открыть старую историю:

1. decrypt legacy material на trusted device
2. re-save backup уже по current canonical contract
3. после этого ordinary password restore на web должен стать deterministic

### 8.8 Если impossible, formalize unsupported policy

Если historical client contract восстановить нельзя, нужно формально принять policy:

- password restore гарантируется только для compatible backup, где contract подтвержден
- если legacy backup не сходится, safe fallback это `fresh web key`
- canonical путь для old history это `QR + history sync`

Сейчас это уже фактически так и работает. Нужно просто зафиксировать это честно.

### 8.9 Явно пометить inferred legacy rows

Backend имеет смысл сделать это явным в contract layer, например одним из вариантов:

- `contract_confidence = canonical | inferred`
- `legacy_contract_inferred = true`

Тогда frontend и docs не будут трактовать inferred rows как `100% deterministic restore contract`.

---

## 9. Что backend не должен делать дальше

- Не считать, что еще один metadata backfill автоматически решит проблему.
- Не считать, что `stored DB row + inference = proven historical contract`.
- Не перекладывать remaining decrypt mismatch обратно на frontend.
- Не смешивать working QR history sync и broken legacy password restore как одну и ту же проблему.

QR flow уже доказан как рабочий.

Legacy password restore это отдельный compatibility problem.

---

## 10. Recommended backend action plan

Минимальный practical план:

1. Зафиксировать sample problematic record как compatibility case.
2. Поднять historical client code path, который создавал backup на `2026-02-27`.
3. Сравнить historical encrypt path с current declared API contract.
4. Если contract подтверждается, выдать frontend deterministic test vector.
5. Если contract не подтверждается, пересохранить backup через trusted device или признать format unsupported для password restore.
6. Явно пометить inferred legacy rows в API или как минимум в backend contract/docs.
7. После этого обновить docs, чтобы current backend truth не притворялась stronger guarantee, чем она реально дает для legacy rows.

---

## 11. Acceptance criteria

Считать проблему закрытой можно только в одном из двух случаев.

### Вариант A. Legacy password restore действительно восстановлен

- exact historical contract найден
- deterministic test vector выдан
- frontend по нему успешно decrypt'ит sample legacy backup
- restored public key совпадает с expected
- ordinary password restore работает end-to-end

### Вариант B. Legacy password restore официально ограничен

- backend честно фиксирует, что данный legacy class не гарантируется к password restore today
- QR path остается canonical для old history
- fresh-key path остается canonical для ordinary web onboarding
- UX и docs больше не обещают deterministic restore там, где его нельзя доказать

---

## 12. Финальный вывод

Сейчас проблема выглядит так:

- это не проблема ordinary auth
- это не проблема QR linked-device flow
- это не проблема web decrypt старой истории
- это не проблема raw key import на frontend

Это проблема того, что exact historical crypto contract конкретного legacy backup не доказан backend/mobile стороной, а current API response for legacy rows partially reconstructed через defaults, backfill и inference.

Поэтому следующий шаг должен быть не "добавить еще один fallback на frontend", а:

- либо доказать exact legacy contract
- либо re-save backup в canonical format
- либо formalize unsupported legacy policy

Без этого ordinary password restore для таких legacy records нельзя считать 100% deterministic и production-safe.
