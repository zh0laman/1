# E2EE Legacy Backup Debug Report For Backend

Актуально по состоянию на `2026-04-05`.

Этот документ нужен backend/mobile команде как точное описание текущего блокера по ordinary password login с recovery backup.

Цель документа:

- зафиксировать, что уже проверено на frontend
- показать, где именно ломается restore flow
- отделить frontend bugs от legacy backup contract mismatch
- описать, что backend/mobile должны подтвердить или предоставить, чтобы восстановление работало детерминированно

---

## 1. Краткий итог

Текущий ordinary login flow на frontend реализован корректно под backend contract:

1. `POST /auth/login`
2. `GET /api/v1/e2ee/backup`
3. local decrypt backup через `master password`
4. derive restored `public_key`
5. `POST /api/v1/e2ee/device/register`
6. replace bootstrap tokens на linked-device tokens

Frontend уже поддерживает оба варианта backup payload:

- `backup_key_format = pkcs8-der-base64`
- `backup_key_format = raw-32-bytes`

Но конкретный legacy backup пользователя сейчас не расшифровывается даже на этапе `AES-GCM decrypt`.

Это значит:

- проблема уже не в login UI
- проблема уже не в том, что frontend не понимает `raw-32-bytes`
- проблема уже не в import private key format
- текущий блокер находится раньше: symmetric decrypt key не совпадает с ключом, которым backup был реально зашифрован

Иными словами:

- либо введен не тот `master password`
- либо этот legacy backup был исторически создан по другому crypto contract, чем backend сейчас нормализует и отдает через API

---

## 2. Runtime кейс, который воспроизведен

### 2.1 Login

`POST /api/v1/auth/login` проходит успешно.

То есть:

- обычный пароль пользователя валидный
- bootstrap auth flow работает
- ошибка не связана с обычной авторизацией

### 2.2 Backup response

`GET /api/v1/e2ee/backup` возвращает backup со следующими характеристиками:

- `kdf_algorithm = pbkdf2-sha256`
- `kdf_params.iterations = 310000`
- `kdf_params.key_length = 32`
- `kdf_params.hash = sha256`
- `version = 1`
- `backup_key_type = x25519`
- `backup_key_format = raw-32-bytes`
- `backup_key_scope = device_identity`
- `backup_format_version = 1`
- `cipher_algorithm = aes-256-gcm`
- `cipher_tag_embedded = true`
- `aad_mode = none`
- `password_processing = utf8-raw`
- `created_at = 2026-02-27T04:29:28.564783Z`
- `updated_at = 2026-02-27T04:29:28.564783Z`

Дополнительно по payload:

- `iv` после Base64 decode имеет длину `12 bytes`
- `salt` после Base64 decode имеет длину `16 bytes`
- `encrypted_private_key` после Base64 decode имеет длину `48 bytes`

На уровне metadata это выглядит как валидный legacy PBKDF2 backup.

---

## 3. Что frontend делает сейчас

Frontend restore flow сейчас работает так:

1. Берет введенный пользователем `master password`
2. Кодирует его как raw UTF-8 bytes
3. Строит symmetric key через:
   - `PBKDF2`
   - `iterations = 310000`
   - `hash = SHA-256`
   - `derived key length = 32 bytes`
4. Пытается расшифровать `encrypted_private_key` через `AES-GCM`
5. Только если decrypt успешен:
   - при `pkcs8-der-base64` трактует plaintext как Base64 string PKCS#8
   - при `raw-32-bytes` трактует plaintext как raw `32-byte X25519 private key`
6. Вычисляет `public_key`
7. Регистрирует web device через `device/register`

Важно:

- `master password` не отправляется на backend
- frontend не подбирает `iterations` или `key_length` наугад
- frontend не гадает `backup_key_format`, а берет его из backend response
- frontend не отправляет guessed `public_key`, если restore не удался

---

## 4. Что уже исправлено на frontend

Ранее UI показывал слишком общую ошибку:

- `Failed to decrypt E2EE backup. Check the master password.`

Это было плохо, потому что такой текст смешивал два разных случая:

- реальный decrypt failure
- format/import mismatch уже после decrypt

Сейчас frontend разделяет эти ситуации.

Поддержка `raw-32-bytes` добавлена явно:

- legacy raw private key material больше не импортируется как `pkcs8`
- frontend умеет трактовать его как raw `32-byte X25519 private key`
- далее raw key оборачивается в корректный PKCS#8 wrapper для стабильного browser import

То есть текущая ошибка уже честная:

- это не format mismatch после decrypt
- это именно failure на этапе decrypt

---

## 5. Что подтверждено локальной криптопроверкой

Тот же exact payload был воспроизведен локально вне UI:

- тот же `salt`
- тот же `iv`
- тот же `encrypted_private_key`
- тот же `PBKDF2-SHA256`
- те же `iterations = 310000`
- та же длина ключа `32`
- тот же `AES-256-GCM`

Результат:

- `AES-GCM` не проходит authentication
- decrypt падает до этапа import key

Это критически важный вывод.

Если бы проблема была только в `backup_key_format`, то:

- decrypt прошел бы
- а ошибка возникла бы позже, на этапе import/normalize private key

Но здесь decrypt не проходит вообще.

Следовательно, на текущем runtime path frontend не получает тот symmetric key, которым backup реально был зашифрован.

---

## 6. Что это доказывает

### 6.1 Что это точно не frontend bug в формате ключа

Это не ошибка вида:

- frontend ожидал `pkcs8`, а получил raw
- frontend не умел `raw-32-bytes`
- frontend падал на import key

Эта часть уже исправлена.

### 6.2 Что это точно не проблема обычного password login

`POST /auth/login` проходит.

Значит:

- обычный пароль пользователя корректен
- auth/session flow работает
- ошибка связана только с E2EE recovery backup

### 6.3 Что это означает по сути

Остаются только две реальные гипотезы:

1. Пользователь вводит не тот `E2EE master password`
2. Legacy backup исторически был создан другим клиентом/кодом, где crypto contract отличался от текущего backend-normalized contract

---

## 7. Что backend реально гарантирует сейчас

По коду backend видно следующее.

### 7.1 Backend не знает master password

Backend:

- не получает `master password`
- не расшифровывает backup
- хранит только encrypted blob + metadata

То есть backend не может на своей стороне доказать, что данный backup действительно дешифруется при текущем contract response.

### 7.2 Backend нормализует metadata

Backend заполняет canonical/normalized metadata для backup:

- `backup_key_type`
- `backup_key_format`
- `backup_key_scope`
- `cipher_algorithm`
- `password_processing`

Но это normalizing/backfill layer, а не runtime decrypt proof.

### 7.3 Backend выводит legacy `raw-32-bytes` через inference

Legacy `raw-32-bytes` сейчас определяется по косвенному признаку:

- старый `pbkdf2-sha256`
- `version = 1`
- длина ciphertext после Base64 decode равна `32 + 16`

Это разумная эвристика, но это не полное доказательство исторического crypto contract.

### 7.4 Backend backfill'ит PBKDF2 params

Для legacy `pbkdf2-sha256` version `1` backend deterministic backfill'ит:

- `iterations = 310000`
- `key_length = 32`
- `hash = sha256`

Это тоже улучшает контракт, но само по себе не доказывает, что конкретный record был когда-то реально создан именно с этими exact параметрами.

---

## 8. Где именно находится архитектурный разрыв

Проблема не в том, что backend response сейчас "совсем плохой".

Проблема в том, что legacy record был создан раньше, а backend today contract является:

- частично canonical metadata
- частично legacy inference
- частично deterministic backfill

Для production compatibility этого недостаточно, если нужен 100% детерминированный restore именно старого backup.

Сейчас backend умеет сказать:

- "скорее всего это legacy raw X25519 backup"
- "скорее всего для него нужно `pbkdf2-sha256`, 310000, 32, sha256"

Но backend не умеет доказать:

- что это точно тот password preprocessing
- что это точно тот exact PBKDF2 profile, который был на старом клиенте
- что backup был создан именно без дополнительных отличий в старом client code

Именно из-за этого запись может выглядеть правильной, но не дешифроваться.

---

## 9. Что backend/mobile должны проверить

### 9.1 Источник создания этого backup

Нужно установить:

- какой клиент создал этот backup
  - старый mobile
  - старый web
  - другой legacy client
- какой exact code path использовался
- был ли этот backup создан до появления current explicit contract metadata

### 9.2 Exact password preprocessing

Нужно подтвердить, что старый клиент действительно делал:

- raw UTF-8 bytes
- без `trim`
- без lowercasing
- без Unicode normalization
- без pepper
- без дополнительных преобразований строки

Сейчас backend отдает `password_processing = utf8-raw`, но это значение для legacy record фактически является semantic declaration, а не доказанным runtime fact.

### 9.3 Exact KDF contract старого клиента

Нужно подтвердить:

- это точно был `PBKDF2-HMAC-SHA256`
- iterations были точно `310000`
- derived key length была точно `32`
- не было ли другого legacy iteration count
- не было ли другой исторической ветки `pbkdf2`

### 9.4 Exact AES-GCM payload contract

Нужно подтвердить:

- tag действительно embedded в ciphertext
- не было отдельного envelope
- не было дополнительного AAD
- не было другой исторической сериализации ciphertext

### 9.5 Exact plaintext contract

Хотя текущий failure происходит до import key, все равно нужно формально зафиксировать:

- plaintext этого legacy формата действительно raw `32-byte X25519 private key`
- а не другой 32-byte blob с дополнительной semantics

---

## 10. Что нужно дать frontend, чтобы закрыть проблему полностью

Нужен один из следующих вариантов.

### Вариант A. Deterministic test vector

Лучший вариант.

Нужно дать один рабочий fixture:

- `master_password`
- `salt`
- `iv`
- `encrypted_private_key`
- `kdf_algorithm`
- `kdf_params`
- `backup_key_format`
- expected plaintext bytes
- expected derived `public_key`

Если frontend по этому vector не сможет расшифровать backup, значит ошибка на frontend.
Если сможет, значит проблема именно в legacy record конкретного пользователя.

### Вариант B. Exact old client code path

Если test vector дать нельзя, нужно показать:

- какой старый mobile/web код реально создавал этот backup
- exact implementation encrypt path
- exact implementation password -> KDF path

### Вариант C. Recreate canonical backup

Если у пользователя есть устройство, которое все еще умеет читать старую историю:

1. расшифровать legacy backup на этом trusted client
2. сохранить новый backup уже по canonical current contract
3. после этого ordinary restore flow на web должен стать детерминированным

### Вариант D. Unsupported legacy policy

Если ни vector, ни old code, ни re-save недоступны, нужно честно зафиксировать policy:

- этот тип legacy backup больше не гарантируется к password-based restore
- ordinary login с recovery для него unsupported
- путь только:
  - `fresh-key`
  - `QR + history sync`

---

## 11. Что backend стоит сделать по уму

### 11.1 Не выдавать вид полной детерминированности там, где ее нет

Если `raw-32-bytes` определяется inference'ом, а не исторически сохраненным exact format id, это нужно явно понимать как legacy compatibility mode, а не как cryptographically proven contract.

### 11.2 Ввести более явный legacy provenance

Желательно иметь отдельные поля или внутренний policy layer:

- `legacy_contract_inferred = true/false`
- `legacy_source = mobile-v1 / web-v1 / unknown`
- `restore_confidence = canonical / inferred / unsupported`

Даже если это не уйдет наружу в API, для backend debugging это критично полезно.

### 11.3 Сделать хотя бы один real fixture test

Сейчас в backend repo есть тесты на metadata normalization, но нет реального end-to-end test vector:

- password
- KDF
- AES decrypt
- expected private key/public key

Без этого legacy compatibility остается в зоне предположений.

### 11.4 Зафиксировать migration strategy

Для legacy backup нужно формально решить:

- поддерживаем read/restore indefinitely
- поддерживаем только при наличии compatible mobile
- мигрируем в canonical format при следующем успешном decrypt
- unsupported legacy records переводим в QR-only recovery path

---

## 12. Что НЕ нужно сейчас делать

Не нужно считать, что проблему решит еще один frontend fallback.

Frontend уже:

- понимает `raw-32-bytes`
- различает decrypt failure и format failure
- не импортирует raw key как `pkcs8`
- не угадывает metadata сверх backend response

Еще один guessing-layer на frontend только ухудшит ситуацию и сделает restore nondeterministic.

Также не нужно говорить, что ordinary password login "по определению уже работает".

Он работает только для тех backup, чей actual historical crypto contract совпадает с backend-declared contract.

Для данного record это пока не доказано.

---

## 13. Backend next steps

Минимальный practical список шагов:

1. Найти exact origin этого backup record по времени создания `2026-02-27T04:29:28.564783Z`
2. Установить, какой клиент его создал
3. Поднять exact encrypt path того клиента
4. Подтвердить или опровергнуть:
   - `utf8-raw`
   - `PBKDF2-SHA256`
   - `iterations = 310000`
   - `key_length = 32`
   - `AES-256-GCM`
   - embedded tag
   - `raw-32-byte X25519 private key`
5. Дать frontend deterministic fixture или test vector
6. Если old contract не восстанавливается, formalize unsupported legacy policy

---

## 14. Acceptance criteria

Считать проблему решенной можно только если выполнено одно из двух:

### Вариант 1. Legacy restore действительно доказан

- backend/mobile дают exact test vector
- frontend по этому vector успешно decrypt'ит backup
- из plaintext получается корректный `public_key`
- ordinary password login с recovery реально работает end-to-end

### Вариант 2. Legacy restore официально признан unsupported

- backend фиксирует, что этот тип старого backup не гарантируется к decrypt today
- frontend показывает честную ошибку
- продуктовый путь становится:
  - `fresh-key flow`
  - или `QR + history sync`

---

## 15. Финальный вывод

Текущий блокер не является обычной frontend ошибкой.

На данный момент доказано следующее:

- frontend реализует current restore flow корректно
- frontend поддерживает `raw-32-bytes`
- конкретный backup падает до import key, уже на `AES-GCM decrypt`
- значит mismatch находится на уровне actual legacy crypto contract

Поэтому следующий шаг должен быть не "добавить еще одну догадку на frontend", а:

- либо подтвердить exact historical contract этого backup
- либо признать этот legacy backup unsupported для password-based restore

Без этого ordinary login recovery для данного пользователя не может считаться 100% deterministic и production-safe.
