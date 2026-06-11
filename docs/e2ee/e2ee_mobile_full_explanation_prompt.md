# E2EE Mobile Full Explanation Prompt

Ниже готовый промпт для mobile-команды или mobile-агента.  
Его цель: заставить mobile-сторону подробно и проверяемо объяснить, как у них реально устроен E2EE flow от и до.

```md
Нужно, чтобы ты как mobile-разработчик/владелец mobile E2EE-логики подробно и без пропусков объяснил, как именно у вас работает end-to-end encryption на мобильной стороне.

Мне не нужен общий обзор уровня “есть ключи, есть шифрование”. Мне нужна полная техническая картина, привязанная к реальному mobile-коду, реальным моделям данных и реальным API-контрактам.

Пиши ответ строго по исходникам mobile-проекта. Не фантазируй. Если чего-то нет в коде, так и напиши: “в коде это не найдено” или “это предположение, а не подтверждённый факт”.

Ответ нужен в markdown.

## Главная цель

Объясни mobile E2EE flow от и до так, чтобы по твоему ответу можно было:

1. Понять, как создаётся identity пользователя на мобильном устройстве.
2. Понять, где и как хранятся приватные ключи, публичные ключи, device keys, backup-материалы и служебные метаданные.
3. Понять, как mobile создаёт recovery backup.
4. Понять, как mobile восстанавливает recovery backup.
5. Понять, как mobile передаёт ключи/историю другому устройству.
6. Понять, как mobile участвует в linked-device / QR flow.
7. Понять, как mobile шифрует сообщения для нескольких устройств.
8. Понять, как mobile расшифровывает старую и новую историю.
9. Понять, какие именно контракты mobile ожидает от backend.
10. Понять, где может возникать несовместимость между mobile, backend и web.

## Обязательные правила ответа

1. Для каждого важного утверждения давай ссылку на конкретный mobile-файл, класс, функцию, метод, модель, use case или сервис.
2. Если описываешь алгоритм, укажи точные параметры:
   - алгоритм
   - KDF
   - salt
   - iv/nonce
   - key length
   - iterations / memory / parallelism
   - формат сериализации
3. Если есть разные ветки логики:
   - legacy
   - current
   - migration
   - fallback
   обязательно раздели их явно.
4. Если где-то mobile полагается на backend metadata, явно покажи это место.
5. Если где-то mobile сам “угадывает” формат legacy backup или контракт, покажи это отдельно.
6. Не пиши общими словами “ключ сохраняется безопасно”. Объясни:
   - куда именно
   - в каком виде
   - кто может его прочитать
   - чем он защищён
7. Если есть platform-specific различия:
   - Android
   - iOS
   раздели их.

## Структура ответа

Ответ дай строго по таким разделам.

### 1. High-Level Architecture

Объясни общую архитектуру mobile E2EE:

- какие сущности существуют
- какие типы ключей существуют
- какая из них является identity key
- есть ли device key, session key, message key, backup key
- где mobile выступает как source of truth, а где только клиент backend-контракта

Нужна схема в тексте:

- пользователь
- устройство
- identity
- backup
- сообщения
- fan-out на устройства

### 2. Mobile Identity Lifecycle

Пошагово объясни, что происходит при самом первом входе пользователя в мобильное приложение:

1. Когда именно создаются ключи.
2. Какие именно ключи создаются.
3. Как формируется device identity.
4. Что сохраняется локально сразу после генерации.
5. Что отправляется на backend.
6. Какие API вызываются.
7. Какие поля уходят в запросах.
8. Что приходит в ответе.

Если возможны разные сценарии:

- новый пользователь
- существующий пользователь
- reinstall app
- новый телефон
- очистка storage

распиши их отдельно.

### 3. Local Storage and Secret Handling

Объясни, где mobile хранит:

- private identity key
- public identity key
- device id
- registration state
- master password-derived material
- backup blob
- backup metadata
- encrypted message cache
- session tokens, если они влияют на E2EE flow

Для каждого пункта укажи:

- точное место хранения
- формат хранения
- шифруется ли оно локально
- используется ли Keychain / Keystore / Secure Enclave / EncryptedSharedPreferences / SQLCipher / Realm / plain storage / custom wrapper
- что переживает reinstall, а что нет

### 4. Master Password Semantics

Объясни, как mobile понимает master password:

- когда он впервые появляется
- создаёт ли mobile его сам или пользователь вводит вручную
- отправляется ли master password на backend
- используется ли он только локально
- что именно из него derivеится
- derivеится ли напрямую backup key или intermediate key
- можно ли по master password восстановить identity

Если mobile использует разные режимы:

- restore-first
- fresh-key
- QR linked-device

покажи, как master password участвует или не участвует в каждом режиме.

### 5. Backup Creation Flow

Это один из самых важных разделов.

Объясни абсолютно подробно, как mobile создаёт recovery backup:

1. Из чего он состоит.
2. Какие поля включает backup payload.
3. Что именно шифруется внутри backup.
4. Какой KDF используется.
5. Как генерируется salt.
6. Как генерируется iv/nonce.
7. Какой encryption algorithm используется.
8. Какой output format получается:
   - base64
   - json
   - binary blob
   - protobuf
   - что-то ещё
9. Какие metadata mobile сохраняет рядом с backup.
10. Какие metadata отправляются на backend.

Покажи exact contract:

- имя полей
- версия
- key format
- backup type
- kdf params
- cipher params

Если есть legacy backup contract и новый canonical contract, сравни их явно таблицей:

- что было раньше
- что стало сейчас
- что mobile всё ещё умеет читать
- что mobile уже не умеет читать

### 6. Backup Restore Flow

Объясни полный restore flow:

1. Откуда mobile берёт backup.
2. Как mobile выбирает между несколькими backup-форматами, если они есть.
3. Как mobile определяет legacy vs current.
4. Как mobile derivеит backup key.
5. Как mobile делает decrypt.
6. Как mobile проверяет, что decrypt успешный.
7. Как mobile импортирует восстановленный private key обратно в runtime/store.
8. Что делает mobile, если decrypt не удался.

Отдельно объясни, какие именно причины могут дать ошибку вида:

- master password mismatch
- malformed backup
- wrong contract metadata
- backend returned incomplete metadata
- legacy contract mismatch
- unsupported backup format

### 7. Device-to-Device Transfer and QR Flow

Подробно объясни linked-device / QR flow на mobile:

1. Как создаётся pairing session.
2. Какие mobile-экраны и use cases участвуют.
3. Что кодируется в QR.
4. Как mobile подтверждает новый web/device.
5. Передаёт ли mobile identity key напрямую.
6. Передаёт ли mobile историю.
7. Передаёт ли mobile fan-out keys для старых сообщений.
8. Как mobile помечает новый device как trusted / linked / approved.
9. Какие API тут вызываются.
10. Что именно mobile отправляет на backend при approve/sync/redeem.

Если QR flow состоит из нескольких фаз, распиши последовательность по шагам:

- create pairing
- scan QR
- approve
- sync history
- redeem
- persist new device

### 8. Message Encryption Flow

Объясни, как mobile шифрует новое сообщение:

1. Как генерируется message key.
2. Как шифруется content.
3. Как формируется `encrypted_keys` или его эквивалент.
4. На какие устройства идёт fan-out.
5. Откуда mobile берёт список устройств.
6. Что происходит, если у пользователя несколько устройств.
7. Что происходит, если новое устройство появилось позже.
8. Что происходит, если старое устройство revoked.

Обязательно покажи:

- как mobile строит payload сообщения
- какие поля шифруются
- какие поля нет
- как mobile решает, для каких device ids класть encrypted key envelope

### 9. Message Decryption Flow

Объясни, как mobile расшифровывает сообщение:

1. Как mobile определяет текущий device id.
2. Как mobile ищет свой encrypted message key envelope.
3. Что делает, если текущего device id нет в `encrypted_keys`.
4. Может ли mobile восстановить старое сообщение через identity restore.
5. Когда нужен history sync / fan-out / QR flow.

Отдельно объясни разницу между:

- “есть backup, но нет message fan-out envelope”
- “нет backup”
- “есть backup, но decrypt backup не удался”
- “device registered as fresh device”

### 10. Mobile <-> Backend Contract

Собери список всех backend endpoints, которые участвуют в mobile E2EE flow:

- auth/login
- e2ee/backup
- e2ee/device/register
- pairing / qr endpoints
- message send / receive endpoints
- любые sync/history endpoints

Для каждого endpoint укажи:

- когда вызывается
- кем вызывается
- request fields
- response fields
- какие поля обязательны для mobile E2EE semantics

Особенно важно:

покажи, какие metadata mobile ожидает получить от backend для legacy backup restore.

### 11. Legacy Compatibility

Отдельно и очень подробно объясни legacy слой:

- какие старые backup-форматы вообще существовали
- какие старые KDF/cipher contracts были
- как mobile определяет, что backup legacy
- mobile сам знает legacy contract или берёт его из backend metadata
- есть ли у mobile hardcoded legacy assumptions
- могут ли backend и mobile расходиться в понимании одного и того же legacy backup

Если да, опиши конкретные места риска.

### 12. Cross-Device Scenario Analysis

Разбери конкретный сценарий:

1. Новый пользователь впервые логинится в mobile.
2. Mobile создаёт identity и backup.
3. Потом пользователь идёт на web.
4. Web вводит master password.
5. Дальше возможны 3 варианта:
   - backup успешно расшифровался
   - backup существует, но не расшифровывается
   - backup вообще не найден

Для каждого варианта объясни:

- что произошло на mobile до этого
- что ожидается на backend
- что ожидается на web
- в каком месте может быть несовместимость

### 13. Exact Source Map

В конце дай карту исходников mobile-проекта.

Список должен быть в формате:

- файл / модуль
- его роль
- какие функции в нём критичны
- какие строки / классы смотреть в первую очередь

Мне нужен short-list самых важных mobile E2EE исходников:

- key generation
- backup create
- backup restore
- QR flow
- device registration
- send message encryption
- receive message decryption
- local secure storage
- migration / legacy compatibility

### 14. Known Risks and Open Questions

В финале выдели:

- что подтверждено кодом
- что только предполагается
- где mobile зависит от backend metadata correctness
- где mobile может быть несовместим с web
- где mobile может быть несовместим с legacy backups

Если найдёшь потенциальный баг или неоднозначность, перечисли отдельно.

## Дополнительные требования

1. Если есть sequence diagram — опиши её хотя бы текстом по шагам.
2. Если есть модели данных backup payload — приведи пример JSON.
3. Если есть пример registration payload — приведи пример JSON.
4. Если есть пример encrypted message payload — приведи пример JSON.
5. Если есть migration logic — покажи decision tree:
   - old backup
   - current backup
   - no backup
   - broken metadata
   - QR fallback

## Запреты

Не пиши:

- “скорее всего”
- “наверное”
- “обычно”
- “примерно так”

если это не подтверждено кодом.

Если чего-то нет в коде, прямо пиши:

- “в mobile-коде это не найдено”
- “это поведение не подтверждено”
- “это следует уточнить у backend”

## Итог

Мне нужен ответ уровня внутреннего технического аудита mobile E2EE, а не обзор для менеджера.
```
