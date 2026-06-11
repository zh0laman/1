# Mobile E2EE Post-QR Final Conclusion

## Проблема

После QR linked-device flow наблюдается такой сценарий:

1. Старые сообщения на web после history sync расшифровываются.
2. Первое новое personal E2EE сообщение после QR иногда не расшифровывается на web.
3. Следующие новые сообщения уже начинают расшифровываться нормально.

На web это проявляется так:

- `encrypted_keys has no entry for device <current_web_device_id>`

Это означает, что проблема не в web decrypt и не в формате `content`, а в том, что первое новое сообщение иногда уходит без ключа для нового web-device.

## Подтвержденная причина

По анализу mobile-кода наиболее вероятный root cause такой:

- после `approve` и `history sync` на mobile не инвалидируется E2EE key cache
- `_getCachedUserKeys(..., forceRefresh: true)` все равно может вернуть stale cache из-за `_minFetchInterval = 10s`
- первый post-QR personal send идет по обычному send path без обязательного refresh sender keys
- перед отправкой нет обязательной проверки, что `keys[current_web_device_id]` реально присутствует в fan-out

Итог:

**первое новое сообщение после QR может шифроваться по stale sender-device keys cache.**

## Что нужно исправить на mobile

### Обязательные изменения

1. После успешного `approve` нужно явно инвалидировать E2EE key cache.
2. После `approve` нельзя использовать обычный TTL-кеш для первого post-QR send.
3. Перед первым новым personal сообщением нужно сделать принудительный fresh fetch sender keys для `my_user_id`.
4. `_minFetchInterval = 10s` не должен блокировать этот post-approve refresh.
5. Перед отправкой первого post-QR personal сообщения нужно проверить, что `keys[current_web_device_id]` реально присутствует.

### Практически это означает

Mobile должен гарантировать такой инвариант:

**между `approve` и первым новым personal E2EE send должен быть выполнен refresh sender keys, в котором уже присутствует новый `web_device_id`.**

## Что не выглядит основной проблемой

Сейчас это не похоже на:

- баг web decrypt
- баг websocket
- баг UI
- баг формата V4 `content/keys`
- баг history sync для старых сообщений

History sync нужен для старой истории. Проблема касается именно нового fan-out после QR.

## Критерий успешного фикса

Фикс считается корректным, если стабильно выполняется следующий сценарий:

1. Пользователь сканирует QR.
2. Проходит `approve`.
3. Выполняется history sync.
4. Старые сообщения читаются на web.
5. Самое первое новое personal сообщение после QR тоже читается на web.
6. В payload первого нового сообщения есть `encrypted_keys[current_web_device_id]`.

## Финальный вывод

Главная проблема сейчас находится в mobile post-QR send flow:

- stale sender-device keys cache
- отсутствие жесткого refresh/invalidate барьера после `approve`
- отсутствие обязательной проверки наличия `keys[current_web_device_id]` у первого post-QR сообщения

Главный required fix:

**invalidate cache + force refresh sender keys after approve + verify current web device is included before first send.**
