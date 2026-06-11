# Chat Files Rendering Guide для Frontend

Документ описывает, как фронту:
- загружать файлы
- отправлять их в чат
- корректно отображать сообщения с файлами по форматам

Документ собран по текущей реализации backend и учитывает ее ограничения.

---

## 1. Что реально умеет backend сейчас

Для файлов в чате backend работает в 2 шага:

1. сначала загрузка файла через `POST /api/v1/files/upload`
2. потом отправка chat message через:
   - `POST /api/v1/conversations/{conversation_id}/messages`
   - `POST /api/v1/groups/{group_id}/messages`

Поддерживаемые `message.type` для чата:
- `text`
- `image`
- `video`
- `file`
- `audio`
- `voice`
- `video_message`

Важно:
- `document` не является chat message type
- документы нужно отправлять как `type: "file"`

---

## 2. Главное ограничение текущего backend

Сейчас публичные send endpoints чата не принимают в request body отдельные поля:
- `attachment_url`
- `attachment_type`
- `attachment_size`

То есть фронт не может отправить нормализованный attachment объект напрямую.

Фактически сейчас:
- upload endpoint возвращает `url`, `object_name`, `filename`, `size`, `type`
- send message endpoint принимает в основном `content` и `type`
- для group chat можно дополнительно передать `metadata`
- для personal chat `metadata` через публичный send endpoint сейчас нет

Следствие для фронта:
- для отправки файла в чат нужно хранить ссылку на файл в `content`
- для group chat можно дополнительно хранить расширенную информацию о файле в `metadata`
- для personal chat после перезагрузки фронт сможет надежно опираться только на:
  - `message.type`
  - `content`
  - и, если backend когда-то их вернет, на `attachment_url`, `attachment_type`, `attachment_size`

---

## 3. Что возвращает upload endpoint

`POST /api/v1/files/upload`

Пример ответа:

```json
{
  "object_name": "image/123/1743178000_file.jpg",
  "url": "http://localhost:8080/api/v1/files/download?object_name=image/123/1743178000_file.jpg",
  "filename": "file.jpg",
  "size": 245678,
  "type": "image"
}
```

Фронту после upload нужно сохранить у себя минимум:
- `object_name`
- `url`
- `filename`
- `size`
- `upload_type`
- `ext`
- `mime`

Рекомендуемый локальный объект на фронте:

```ts
type UploadedChatFile = {
  objectName: string;
  url: string;
  filename: string;
  size: number;
  uploadType: "image" | "video" | "document" | "file";
  messageType: "image" | "video" | "file" | "audio" | "voice" | "video_message";
  ext: string;
  mime: string;
};
```

---

## 4. Как фронту классифицировать файл перед отправкой

### 4.1 Маппинг upload type и chat message type

| Локальный формат | Upload `type` | Chat `message.type` | Как рендерить |
|---|---|---|---|
| `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | `image` | `image` | картинка/превью |
| `.mp4`, `.mov`, `.avi`, `.mkv` | `video` | `video` | video player |
| voice-note, audio message | `file` | `voice` | voice bubble |
| обычный audio file | `file` | `audio` | audio player |
| `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.txt` | `document` | `file` | карточка документа |
| `.ppt`, `.pptx` | `file` | `file` | карточка документа |
| `.zip`, `.rar`, `.7z`, `.csv`, `.json`, прочие файлы | `file` | `file` | generic file card |
| короткое круглое видео | `video` | `video_message` | video-message bubble |

### 4.2 Почему `ppt/pptx` лучше грузить как `file`

В backend:
- MIME для `ppt/pptx` уже определен
- но `document` validation их сейчас не пропускает

Поэтому для надежной работы:
- `pdf/doc/docx/xls/xlsx/txt` можно грузить как `document`
- `ppt/pptx` лучше грузить как обычный `file`

### 4.3 Почему audio лучше грузить как `file`

У backend нет отдельного upload type `audio`.

Поэтому:
- upload: `type=file`
- send message: `type=audio` или `type=voice`

---

## 5. Поддерживаемые backend ограничения по размерам

На текущем backend:
- image: до `50MB`
- video: до `1GB`
- document: до `100MB`
- generic file: до `500MB`

Backend-валидируемые document extensions:
- `.pdf`
- `.doc`
- `.docx`
- `.xls`
- `.xlsx`
- `.txt`

Backend-валидируемые image extensions:
- `.jpg`
- `.jpeg`
- `.png`
- `.gif`
- `.webp`

Backend-валидируемые video extensions:
- `.mp4`
- `.mov`
- `.avi`
- `.mkv`

---

## 6. Рекомендуемый flow отправки файла в чат

### 6.1 Шаг 1. Пользователь выбирает файл

Фронт должен:
- определить extension
- определить mime на клиенте
- определить `uploadType`
- определить `messageType`

### 6.2 Шаг 2. Загрузить файл

Пример:

```bash
curl -X POST "$BASE_URL/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@spec.pdf" \
  -F "type=document"
```

Если это `ppt/pptx`, audio или любой неизвестный тип:

```bash
curl -X POST "$BASE_URL/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@presentation.pptx" \
  -F "type=file"
```

### 6.3 Шаг 3. Отправить сообщение в чат

Для personal chat:

```json
{
  "content": "http://localhost:8080/api/v1/files/download?object_name=file/123/...",
  "type": "file"
}
```

Для group chat можно лучше:

```json
{
  "content": "http://localhost:8080/api/v1/files/download?object_name=file/123/...",
  "type": "file",
  "metadata": "{\"attachment\":{\"object_name\":\"file/123/...\",\"filename\":\"spec.pdf\",\"size\":245678,\"mime\":\"application/pdf\",\"ext\":\".pdf\"}}"
}
```

### 6.4 Шаг 4. Показать optimistic message

До ответа backend фронт должен локально показать сообщение с:
- filename
- size
- локальным статусом upload/send
- превью, если это image/video

После ответа сервера:
- заменить локальное временное сообщение на реальное
- сохранить локальные attachment-данные рядом с message id

---

## 7. Как фронту решать, чем рендерить сообщение

Надежный приоритет определения renderer:

1. `message.type`
2. `message.attachment_type`
3. `metadata.attachment.mime`
4. extension из `metadata.attachment.filename`
5. extension из `content`

Рекомендуемое правило:
- сначала ориентироваться на `message.type`
- MIME и extension использовать как fallback
- не полагаться только на `attachment_type`, потому что в текущем чате он может быть пустым

---

## 8. Рекомендуемые UI renderer'ы по типам

### 8.1 `image`

Рендер:
- thumbnail
- click to open
- optional lightbox

Что показывать:
- превью изображения
- размер файла
- имя файла опционально

Fallback:
- если картинка не открылась, показать обычную file-card с иконкой image

### 8.2 `video`

Рендер:
- video preview card
- poster/thumbnail если удалось получить
- кнопка play

Что показывать:
- название файла
- размер файла
- длительность, если смогли вычислить на клиенте

Fallback:
- если inline video не проигрывается, показать file-card + download/open

### 8.3 `video_message`

Рендер:
- компактный видео-баббл
- квадратный или круглый UI, если это соответствует дизайну продукта
- autoplay muted только если это допустимо UX

Если фронт не поддерживает отдельный renderer:
- отображать как обычный `video`

### 8.4 `audio`

Рендер:
- audio player
- play/pause
- progress
- current time / duration

Что показывать:
- filename
- size

Важно:
- MIME для audio backend может не определить автоматически
- фронт должен уметь fallback по extension и по `message.type === "audio"`

### 8.5 `voice`

Рендер:
- voice message bubble
- play/pause
- progress
- duration

Отличие от `audio`:
- `voice` это UX-тип голосового сообщения
- `audio` это обычный звуковой файл

Если отдельного voice UI нет:
- временно рендерить как `audio`

### 8.6 `file`

Рендер:
- file card
- иконка по типу документа
- filename
- readable size
- кнопки `Open` / `Download`

Для документов:
- `pdf` -> иконка PDF
- `doc/docx` -> иконка Word
- `xls/xlsx/csv` -> иконка Excel/Table
- `ppt/pptx` -> иконка Presentation
- `txt` -> иконка Text
- `zip/rar/7z` -> иконка Archive
- unknown -> generic file icon

---

## 9. Рекомендуемая file-card модель на фронте

```ts
type ChatAttachmentViewModel = {
  kind: "image" | "video" | "video_message" | "audio" | "voice" | "file";
  url: string;
  objectName?: string;
  filename: string;
  size?: number;
  mime?: string;
  ext?: string;
  icon:
    | "image"
    | "video"
    | "audio"
    | "pdf"
    | "word"
    | "excel"
    | "presentation"
    | "text"
    | "archive"
    | "file";
};
```

---

## 10. Рекомендуемый алгоритм нормализации message для UI

```ts
type MessageLike = {
  type: string;
  content?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  metadata?: string | null;
};

function getExt(value?: string | null): string | undefined {
  if (!value) return undefined;
  const clean = value.split("?")[0];
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return undefined;
  return clean.slice(lastDot).toLowerCase();
}

function iconByExt(ext?: string): ChatAttachmentViewModel["icon"] {
  switch (ext) {
    case ".pdf":
      return "pdf";
    case ".doc":
    case ".docx":
      return "word";
    case ".xls":
    case ".xlsx":
    case ".csv":
      return "excel";
    case ".ppt":
    case ".pptx":
      return "presentation";
    case ".txt":
      return "text";
    case ".zip":
    case ".rar":
    case ".7z":
      return "archive";
    default:
      return "file";
  }
}

function resolveChatAttachment(message: MessageLike): ChatAttachmentViewModel | null {
  const url = message.attachment_url || message.content || "";
  if (!url || message.type === "text") return null;

  let metadataAttachment: any = null;
  if (message.metadata) {
    try {
      const meta = JSON.parse(message.metadata);
      metadataAttachment = meta?.attachment ?? null;
    } catch {}
  }

  const ext =
    metadataAttachment?.ext ||
    getExt(metadataAttachment?.filename) ||
    getExt(url);

  const filename =
    metadataAttachment?.filename ||
    url.split("/").pop()?.split("?")[0] ||
    "file";

  switch (message.type) {
    case "image":
      return { kind: "image", url, filename, size: message.attachment_size || metadataAttachment?.size, mime: message.attachment_type || metadataAttachment?.mime, ext, icon: "image" };
    case "video":
      return { kind: "video", url, filename, size: message.attachment_size || metadataAttachment?.size, mime: message.attachment_type || metadataAttachment?.mime, ext, icon: "video" };
    case "video_message":
      return { kind: "video_message", url, filename, size: message.attachment_size || metadataAttachment?.size, mime: message.attachment_type || metadataAttachment?.mime, ext, icon: "video" };
    case "audio":
      return { kind: "audio", url, filename, size: message.attachment_size || metadataAttachment?.size, mime: message.attachment_type || metadataAttachment?.mime, ext, icon: "audio" };
    case "voice":
      return { kind: "voice", url, filename, size: message.attachment_size || metadataAttachment?.size, mime: message.attachment_type || metadataAttachment?.mime, ext, icon: "audio" };
    case "file":
    default:
      return { kind: "file", url, filename, size: message.attachment_size || metadataAttachment?.size, mime: message.attachment_type || metadataAttachment?.mime, ext, icon: iconByExt(ext) };
  }
}
```

---

## 11. Что фронту лучше хранить в metadata для group chat

Так как group message принимает `metadata`, рекомендуемая схема:

```json
{
  "attachment": {
    "object_name": "file/123/1743178000_abcd.pdf",
    "filename": "spec.pdf",
    "size": 245678,
    "mime": "application/pdf",
    "ext": ".pdf",
    "upload_type": "document"
  }
}
```

Это даст фронту после перезагрузки:
- filename
- readable size
- иконку по расширению
- fallback MIME

---

## 12. Что делать с personal chat

В personal chat через текущий публичный endpoint `metadata` не отправляется.

Поэтому для personal chat фронт должен понимать ограничение:
- стабильно сохраняются только `type` и `content`
- если нужен красивый persistent render после reload, фронту придется:
  - держать локальный кэш attachment-метаданных
  - или доработать backend, чтобы personal send endpoint тоже принимал `metadata`
  - или доработать backend, чтобы send endpoint принимал явные поля `attachment_url`, `attachment_type`, `attachment_size`

На текущем backend минимально надежный вариант:
- `content` = download URL
- `type` = `image|video|file|audio|voice|video_message`
- renderer выбирать по `type`
- document icon выбирать по extension из URL

---

## 13. Рекомендуемая frontend стратегия без доработки backend

### 13.1 Если это image

- upload как `image`
- send как `image`
- в `content` класть `url`
- рендерить image bubble

### 13.2 Если это video

- upload как `video`
- send как `video`
- в `content` класть `url`
- рендерить video card/player

### 13.3 Если это voice note

- upload как `file`
- send как `voice`
- в `content` класть `url`
- рендерить voice bubble

### 13.4 Если это обычный audio file

- upload как `file`
- send как `audio`
- в `content` класть `url`
- рендерить audio player

### 13.5 Если это документ

- upload как `document` для `pdf/doc/docx/xls/xlsx/txt`
- upload как `file` для `ppt/pptx` и прочих форматов
- send как `file`
- в `content` класть `url`
- рендерить file card по extension

---

## 14. Короткий чеклист для фронта

- Не отправлять `document` как chat message type
- Документы в чате всегда отправлять как `type: "file"`
- Для audio upload использовать `type=file`
- Для `ppt/pptx` upload использовать `type=file`
- Всегда хранить локально `filename`, `size`, `ext`, `mime` после upload
- В group chat дублировать эти данные в `metadata`
- В personal chat быть готовым к fallback только по `type + content`
- Для renderer сначала смотреть на `message.type`
- Для file-card иконки использовать extension fallback

---

## 15. Когда стоит доработать backend

Фронту будет сильно проще, если backend начнет принимать в chat send endpoint:

```json
{
  "content": "optional caption",
  "type": "file",
  "attachment_url": "http://...",
  "attachment_type": "application/pdf",
  "attachment_size": 245678,
  "metadata": {
    "filename": "spec.pdf",
    "object_name": "file/123/..."
  }
}
```

Тогда:
- исчезнет зависимость от URL в `content`
- personal и group chat станут одинаковыми
- перезагрузка страницы не будет ломать красивый render file card

