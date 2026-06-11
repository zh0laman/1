# Backend E2EE Post-QR Checklist

## Цель

Проверить, что после `QR approve + history sync` backend сразу и консистентно включает новый `web_device_id` в E2EE device list для новых personal сообщений.

Сейчас наблюдается такой сценарий:

1. `redeem` проходит успешно
2. `history sync` проходит успешно
3. старые сообщения на web расшифровываются
4. первое новое сообщение после QR иногда приходит **без** `encrypted_keys[current_web_device_id]`
5. более поздние новые сообщения уже могут приходить корректно

Это указывает на возможную задержку консистентности по device list после linked-device flow.

---

## Что нужно проверить

### 1. Когда новый `web_device_id` становится видимым в `/e2ee/keys`

После успешного:

- `approve`
- `redeem`
- `history sync`

проверьте, с какого именно момента `GET /api/v1/e2ee/keys/{user_id}` начинает возвращать новый `web_device_id`.

Нужно убедиться, что после завершения flow:

- device уже есть в key list
- он виден сразу
- нет задержки репликации/кеша/асинхронной записи

### 2. Консистентность после `history synced`

Если backend логирует:

```text
history synced
status = synced
```

то после этого должно быть гарантировано:

- новый `web_device_id` доступен в `/e2ee/keys/{user_id}`
- mobile при новом fetch увидит этот device

Если это не так, статус `synced` вводит клиентов в заблуждение.

### 3. Проверить race condition между sync и новым message

Нужен сценарий:

1. QR approve
2. history sync complete
3. сразу отправка нового personal сообщения с mobile

Проверьте:

- успел ли backend к этому моменту записать новый `web_device_id`
- возвращается ли он в `/e2ee/keys`
- нет ли окна, где sync уже completed, а device ещё отсутствует в key list

### 4. Проверить фактический payload нового сообщения

Для первого нового personal сообщения после QR проверьте:

- присутствует ли `encrypted_keys[current_web_device_id]`

Если нет, нужно понять:

- mobile не получил device из `/e2ee/keys`
- или backend отдал неполный список устройств

### 5. Проверить отсутствие stale данных на backend уровне

Нужно проверить:

- кеши device list
- eventual consistency после записи нового linked device
- отложенные фоновые операции
- использование разных источников данных для `history sync` и для `/e2ee/keys`

---

## Что считается корректным результатом

После завершения linked-device flow:

1. backend возвращает новый `web_device_id` в `/api/v1/e2ee/keys/{user_id}`
2. первое новое personal E2EE сообщение после QR содержит:

```json
{
  "encrypted_keys": {
    "<current_web_device_id>": "..."
  }
}
```

3. web может расшифровать это сообщение без повторного QR или ожидания дополнительного времени

---

## Что просим проверить и прислать

Нужны 3 факта:

1. лог или ответ `/api/v1/e2ee/keys/{user_id}` сразу после `history synced`
2. payload первого нового personal сообщения после QR
3. подтверждение, что в этом payload есть `encrypted_keys[current_web_device_id]`

---

## Предварительный вывод

Web уже подтверждает следующее:

- history sync работает
- старые сообщения расшифровываются
- новые сообщения расшифровываются, когда `encrypted_keys[current_web_device_id]` реально есть

Значит backend нужно проверить на пост-QR консистентность device list и на момент, когда новый `web_device_id` становится доступен для fan-out новых сообщений.
