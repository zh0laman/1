# CHAT SEARCH FRONTEND API

## Назначение

Этот документ описывает, как фронт должен реализовать **поиск внутри чата** на текущем backend.

Здесь разобрано:

- какой endpoint использовать
- как искать в личке, support-чате и группе
- какие query params поддерживаются
- в каком виде приходят результаты
- как фронту показывать результаты поиска
- что можно сделать красиво, как в Telegram
- какие ограничения у текущего API уже есть

---

## Что у нас есть сейчас

У нас есть **поиск по сообщениям внутри конкретного чата**.

Основной endpoint:

```http
GET /api/v1/search/messages?conversation_id=<chat_id>&q=<query>&limit=<n>
```

Важно:

- это **не глобальный поиск по всем чатам**
- это поиск **внутри одного конкретного `conversation_id`**
- для группы тоже используется этот endpoint, потому что group messages хранятся в той же таблице `messages`, а `conversation_id` для группы равен `group_id`

---

## Какие чаты можно искать

Через `GET /api/v1/search/messages` можно искать в:

- личном чате
- `support` чате
- группе

### Какой `conversation_id` передавать

- для лички: `conversation.id`
- для `support`: `conversation.id`
- для группы: `group.id`

То есть фронту не нужен отдельный endpoint для поиска по группе.

---

## Основной endpoint

```http
GET /api/v1/search/messages
```

### Query params

- `conversation_id`
  - обязательный
  - UUID чата или группы
- `q`
  - обязательный
  - строка поиска
- `limit`
  - необязательный
  - по умолчанию `50`
  - максимум `100`

---

## Базовый пример

### curl

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/search/messages?conversation_id=4b3b7a8d-1111-4444-9999-16a6047c2f11&q=документ&limit=20" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Пример ответа

```json
{
  "query": "документ",
  "messages": [
    {
      "id": "9d38d871-1000-4000-8000-f1f110000001",
      "conversation_id": "4b3b7a8d-1111-4444-9999-16a6047c2f11",
      "sender_id": 52,
      "reply_to_id": null,
      "content": "Скинул документы",
      "content_hash": "f5c1c8e7...",
      "type": "text",
      "attachment_url": null,
      "attachment_type": null,
      "attachment_size": null,
      "metadata": "<mark>Скинул</mark> <mark>документы</mark>",
      "is_edited": false,
      "is_forwarded": false,
      "original_sender_id": null,
      "is_deleted": false,
      "created_at": "2026-04-01T09:10:00Z",
      "updated_at": "2026-04-01T09:10:00Z",
      "edited_at": null,
      "is_ephemeral": false,
      "ttl_seconds": null,
      "expires_at": null,
      "sender_username": "a.saparov",
      "sender_full_name": "Айдын Сапаров",
      "sender_avatar": "https://cdn.example.com/avatar-52.jpg",
      "original_sender_full_name": null,
      "reply_to": null,
      "read_by_count": 0,
      "delivered_count": 0,
      "is_read": false,
      "reactions": []
    }
  ],
  "count": 1
}
```

---

## Пример для группы

### curl

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/search/messages?conversation_id=91f90940-2222-5555-8888-07b598a09b2a&q=бриф&limit=20" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Пример ответа

```json
{
  "query": "бриф",
  "messages": [
    {
      "id": "601ece8d-dddd-eeee-ffff-7626f9f71002",
      "conversation_id": "91f90940-2222-5555-8888-07b598a09b2a",
      "sender_id": 17,
      "reply_to_id": null,
      "content": "Бриф на согласование",
      "content_hash": "c9e3b7d1...",
      "type": "text",
      "attachment_url": null,
      "attachment_type": null,
      "attachment_size": null,
      "metadata": "<mark>Бриф</mark> на согласование",
      "is_edited": false,
      "is_forwarded": false,
      "original_sender_id": null,
      "is_deleted": false,
      "created_at": "2026-04-01T08:58:00Z",
      "updated_at": "2026-04-01T08:58:00Z",
      "edited_at": null,
      "is_ephemeral": false,
      "ttl_seconds": null,
      "expires_at": null,
      "sender_username": "m.admin",
      "sender_full_name": "Мадина Админ",
      "sender_avatar": null,
      "original_sender_full_name": null,
      "reply_to": null,
      "read_by_count": 4,
      "delivered_count": 4,
      "is_read": false,
      "reactions": []
    }
  ],
  "count": 1
}
```

---

## Что именно ищет backend

Поиск построен на PostgreSQL full-text search.

Что важно:

- используется `plainto_tsquery('russian', q)`
- сортировка идет по:
  - `rank DESC`
  - затем `created_at DESC`

Это значит:

- сначала придут более релевантные сообщения
- если релевантность одинаковая, выше будут более новые сообщения

---

## Что индексируется

Сейчас индексируется **только `messages.content`**.

Это очень важное ограничение.

Поэтому поиск сейчас:

- ищет по тексту сообщения
- не гарантирует поиск по `metadata`
- не индексирует `attachment_url`
- не индексирует `attachment_type`
- не индексирует `sender_full_name`
- не индексирует `reply_to.content`

### Что это значит на практике

Найдет:

- обычный текст сообщения
- текст подписи, если она лежит в `content`

Не гарантирует, что найдет:

- имя прикрепленного файла, если оно не лежит в `content`
- mentions из `metadata`
- служебные JSON-поля

---

## Как приходит подсветка найденного текста

Backend реально считает highlight через PostgreSQL `ts_headline` и использует HTML-теги:

```html
<mark>слово</mark>
```

Но есть очень важный нюанс:

- highlight не приходит отдельным полем
- backend кладет highlight в `message.metadata`
- и делает это **только если `metadata == null`**

### То есть

Если у сообщения `metadata` изначально пустой:

- в ответе `metadata` может содержать highlight-строку

Если у сообщения `metadata` уже занято реальными данными:

- highlight туда не попадет
- и в API вы его не получите

### Вывод для фронта

На текущем API нельзя надежно рассчитывать, что highlight всегда будет доступен.

Поэтому фронту лучше:

- использовать `message.content` как основной источник текста
- `metadata` с `<mark>` считать опциональным бонусом
- не завязывать UX поиска только на наличие highlight

---

## Формат результата

Результаты возвращаются в таком контейнере:

```json
{
  "query": "документ",
  "messages": [...],
  "count": 1
}
```

### Поля верхнего уровня

- `query`
  - строка поиска
- `messages`
  - массив найденных сообщений
- `count`
  - количество найденных элементов в текущем ответе

### Важно

`count` здесь:

- не означает общее число совпадений в базе
- это просто размер массива `messages`

Потому что в текущем endpoint нет:

- `offset`
- `page`
- `total_count`

---

## Какие поля у сообщения полезны фронту

Фронту для search result обычно нужны:

- `id`
- `conversation_id`
- `sender_id`
- `content`
- `type`
- `created_at`
- `sender_full_name`
- `sender_avatar`
- `reply_to`
- `is_edited`
- `metadata` как optional highlight

### Что показывать в карточке результата

Рекомендуемый UI результата:

- имя отправителя
- дата/время
- короткий snippet сообщения
- иконка типа сообщения, если это не `text`
- preview reply, если `reply_to != null`

---

## Как фронту реализовать поиск правильно

## 1. Когда начинать поиск

Рекомендуемый сценарий:

- пользователь открыл чат
- нажал на иконку поиска
- открылся search input
- после ввода 2+ символов фронт начинает запросы

### Debounce

Рекомендуется делать debounce:

- `250-400ms`

Это снизит нагрузку и не будет спамить backend на каждую букву.

---

## 2. Какой запрос отправлять

### Пример

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/search/messages?conversation_id=4b3b7a8d-1111-4444-9999-16a6047c2f11&q=отчет&limit=20" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Рекомендованный `limit`

- `20` для выпадающего search panel
- `50` для полноэкранного search drawer

Так как пагинации нет, лучше не просить слишком большой лимит без необходимости.

---

## 3. Как рендерить результаты

### Правильный UX

Результаты надо показывать отдельным списком:

- не смешивать их прямо с обычной лентой чата
- не подменять историю чата полностью

Хороший вариант:

- search overlay / drawer
- список результатов внутри него

У каждого результата:

- sender
- snippet
- date/time
- type badge

---

## 4. Что показывать как snippet

Приоритет:

1. если `metadata` содержит `<mark>` и это реально highlight
   - показывать highlight snippet
2. иначе
   - показывать `content`

### Важно

`metadata` в обычных сообщениях может быть настоящим JSON.

Поэтому фронт не должен слепо считать:

- любой `metadata` = highlight

Надежный подход:

- если `metadata` строка и содержит `<mark>`
  - использовать как highlight preview
- иначе
  - использовать обычный `content`

---

## 5. Как обрабатывать click по результату

Вот здесь у текущего API есть серьезное ограничение.

Сейчас backend **не дает**:

- endpoint "получить сообщения вокруг `message_id`"
- endpoint "перейти к сообщению по id с контекстом"
- `before_id/after_id`
- `around_message_id`
- `message_position`

### Что это значит

Telegram-like сценарий:

- нажать на найденное сообщение
- открыть чат ровно на этой позиции
- показать несколько сообщений выше и ниже

на текущем API **нельзя сделать идеально**.

### Что можно сделать сейчас

Вариант 1:

- при клике открыть обычный чат
- показать сверху баннер:
  - `Найдено сообщение от <дата>`
- отдельно в search panel подсветить выбранный результат

Вариант 2:

- в самом search panel показать полную карточку результата
- а чат открыть в стандартном режиме с последними сообщениями

Вариант 3:

- если найденное сообщение уже есть в локально загруженной истории
  - просто проскроллить к нему
- если его нет
  - показать `jump is not supported by current API`
  - либо догружать историю страницами вручную, пока не найдется

### Практический вывод

Для текущего backend поиск лучше делать как:

- **поиск + список результатов**

а не как:

- **полноценный jump-to-message с контекстом**

---

## Можно ли искать во время открытого чата

Да, это нормальный сценарий.

Рекомендуемая схема:

1. чат уже открыт
2. пользователь вводит строку поиска
3. фронт вызывает `/search/messages`
4. результаты показывает поверх чата отдельной панелью
5. обычный WebSocket чата продолжает жить параллельно

### Что не надо делать

- не нужно перестраивать саму историю чата под результаты поиска
- не нужно заменять обычную ленту массивом найденных сообщений

---

## Отличия от Telegram

Telegram обычно умеет:

- искать по чату
- показывать количество совпадений
- ходить вперед/назад по найденным сообщениям
- прыгать точно в нужную позицию истории

Текущий backend умеет только:

- вернуть список найденных сообщений в чате

Текущий backend не умеет:

- `total_count`
- pagination для search results
- next/prev result navigation на backend
- jump to message with context

---

## Ограничения текущего API

### 1. Нет pagination

Сейчас у поиска нет:

- `offset`
- `cursor`
- `page`

Значит:

- фронт получает только первые `N` результатов по `limit`

### 2. Нет `total_count`

Фронт не знает:

- сколько всего совпадений нашлось

### 3. Нет jump-to-message API

Фронт не может красиво перейти к найденному сообщению с контекстом.

### 4. Highlight ненадежен

Потому что:

- он кладется в `metadata`
- и только если `metadata` пустой

### 5. Поиск индексирует только `content`

То есть поиск по вложениям и служебным данным ограничен.

### 6. В сервисе нет явной проверки участия пользователя в чате

Это важный backend-нюанс.

Сейчас `SearchMessages`:

- принимает `conversation_id`
- и идет напрямую в repository search

Фронту это не ломает контракт, но как ограничение backend это стоит понимать.

### 7. Поиск не фильтрует `last_cleared_at`

История чата при обычной загрузке фильтруется после скрытия/очистки чата.

Но search query сейчас не использует:

- `hidden_at`
- `last_cleared_at`

Это значит:

- теоретически поиск может вернуть сообщения, которые уже не попадают в обычную видимую историю после скрытия/очистки чата

Для фронта это важный риск.

---

## Реальные ошибки

### Нет `conversation_id`

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "conversation_id is required",
    "details": null
  }
}
```

### Нет `q`

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "query parameter 'q' is required",
    "details": null
  }
}
```

### Невалидный UUID

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "invalid conversation ID",
    "details": null
  }
}
```

### Слишком короткий запрос

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "search query must be at least 2 characters",
    "details": null
  }
}
```

### Невалидный `limit`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid query parameters",
    "details": null
  }
}
```

---

## Пустой результат

### curl

```bash
curl --request GET \
  --url "http://localhost:8080/api/v1/search/messages?conversation_id=4b3b7a8d-1111-4444-9999-16a6047c2f11&q=несуществующаястрока&limit=20" \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```

### Ответ

```json
{
  "query": "несуществующаястрока",
  "messages": [],
  "count": 0
}
```

### Что делать фронту

Показывать:

- `Ничего не найдено`

И не считать это ошибкой.

---

## Рекомендуемый фронтовый flow

## Шаг 1. Открыли чат

Фронт уже знает:

- `chat.id`
- `chat.type`

## Шаг 2. Открыли search UI

Например:

- icon button в header чата

## Шаг 3. Пользователь ввел 2+ символа

Фронт делает debounce.

## Шаг 4. Выполнил запрос

```ts
GET /search/messages?conversation_id=<chatId>&q=<query>&limit=20
```

## Шаг 5. Получил список результатов

Фронт рендерит:

- sender
- snippet
- date
- type

## Шаг 6. Пользователь нажал на результат

Если сообщение уже загружено в локальной истории:

- скроллим к нему

Если не загружено:

- открываем чат как обычно
- показываем результат в search panel
- не обещаем точный scroll-to-message, потому что backend этого не умеет

---

## Рекомендуемая реализация на фронте

```ts
type SearchResult = {
  query: string;
  messages: MessageView[];
  count: number;
};

async function searchInChat(chatId: string, query: string): Promise<SearchResult> {
  const q = query.trim();
  if (q.length < 2) {
    return { query: q, messages: [], count: 0 };
  }

  return api.get(
    `/search/messages?conversation_id=${chatId}&q=${encodeURIComponent(q)}&limit=20`
  );
}

function getSearchSnippet(message: MessageView) {
  if (typeof message.metadata === "string" && message.metadata.includes("<mark>")) {
    return {
      html: message.metadata,
      isHtml: true,
    };
  }

  return {
    html: message.content ?? "",
    isHtml: false,
  };
}

function onSearchResultClick(messageId: string, loadedMessageIds: Set<string>) {
  if (loadedMessageIds.has(messageId)) {
    scrollToMessage(messageId);
    return;
  }

  openChatNormally();
  showInfo("Точный переход к найденному сообщению текущий API не поддерживает");
}
```

---

## Что фронту делать не надо

- не надо использовать `GET /search` для поиска по сообщениям
- не надо ожидать, что highlight всегда придет
- не надо ожидать `total_count`
- не надо строить UI "1 из 27 совпадений", потому что backend этого не отдает
- не надо обещать точный jump-to-message, если сообщение не загружено в локальной истории

---

## Итог

Сейчас поиск в чате у нас есть и он рабочий, но это именно:

- **поиск списка сообщений внутри конкретного чата**

а не полный Telegram-style search navigation.

Правильная реализация для фронта на текущем API:

1. открыть chat search UI
2. после 2+ символов вызвать `GET /api/v1/search/messages`
3. передать `conversation_id`, `q`, `limit`
4. отрисовать найденные сообщения отдельным списком
5. использовать `metadata` с `<mark>` только как optional highlight
6. при клике скроллить к сообщению только если оно уже загружено
7. в остальных случаях не пытаться имитировать идеальный jump-to-message, которого backend пока не поддерживает

Это корректный и безопасный фронтовый сценарий под текущую реализацию.
