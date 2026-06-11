# Alem Drive API Guide

Документ фиксирует текущий контракт Alem Drive для мобильной интеграции, включая фактический сценарий открытия office-файлов через OnlyOffice.

## Base URL

Все API-запросы идут на:

`https://<server-domain>/api/v1`

Авторизация:

```http
Authorization: Bearer <access_token>
```

## Базовые эндпоинты Drive

### Список содержимого папки

`GET /drive/folders/{folder_id}/children`

Пример ответа:

```json
[
  {
    "id": "uuid-file",
    "name": "report.docx",
    "type": "file",
    "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 102456,
    "owner_id": 1,
    "updated_at": "2024-05-01T12:00:00Z"
  },
  {
    "id": "uuid-folder",
    "name": "Documents",
    "type": "dir",
    "updated_at": "2024-05-01T12:00:00Z"
  }
]
```

### Получение файла

`GET /drive/files/{file_id}`

Web использует этот эндпоинт, если метаданные файла не были переданы при переходе в редактор.

Ожидаемые полезные поля:

```json
{
  "id": "uuid-file",
  "name": "report.docx",
  "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "owner_id": 60,
  "version": 3,
  "key": "stable-doc-key"
}
```

### Скачивание файла

`GET /drive/files/{file_id}/download`

Для прямого открытия в WebView или для OnlyOffice допускается токен в query:

`GET /drive/files/{file_id}/download?access_token=<access_token>`

### Мои права на ресурс

`GET /drive/permissions/my?resource_id=<file_id>&resource_type=file`

Пример ответа:

```json
{
  "role": "owner"
}
```

Используемые роли:

- `owner`
- `editor`
- `viewer`

## OnlyOffice: текущее реальное поведение web

### Важно

Сейчас web-клиент **не использует** отдельный backend endpoint вида:

`GET /api/v1/drive/onlyoffice/config?file_id=<FILE_ID>`

Иными словами:

- `404 page not found` на этом маршруте соответствует текущей frontend-логике
- web сам собирает объект `config` для `new DocsAPI.DocEditor(...)`
- из backend ему нужны файл, права, download URL и callback URL

## Точный сценарий открытия office-файла

### 1. Роут, который открывает web

При клике по office-файлу (`.docx`, `.xlsx`, `.pptx`, а также другие non-image/non-pdf/non-video файлы) web открывает:

`/drive/editor/:fileId`

Пример:

`/drive/editor/8d4f0d72-2f22-4e4a-8f6b-7a6d40f2e901`

Исходник роутинга:

- [src/presentation/pages/alemdrive/AlemDrivePage.tsx](/d:/alem_project/alem-frontend/src/presentation/pages/alemdrive/AlemDrivePage.tsx:49)

### 2. Как определяется режим edit/view

Перед открытием редактора web делает:

`GET /drive/permissions/my?resource_id=<file_id>&resource_type=file`

Логика:

- если `role` = `owner` или `editor`, открывается режим `edit`
- иначе открывается режим `view`

Исходник:

- [src/presentation/pages/alemdrive/drive-src/pages/Drive.jsx](/d:/alem_project/alem-frontend/src/presentation/pages/alemdrive/drive-src/pages/Drive.jsx:191)
- [src/presentation/pages/alemdrive/drive-src/api/files.js](/d:/alem_project/alem-frontend/src/presentation/pages/alemdrive/drive-src/api/files.js:256)

### 3. Какие данные нужны редактору

Внутри страницы редактора web:

- при необходимости получает метаданные файла через `GET /drive/files/{file_id}`
- строит URL скачивания через `GET /drive/files/{file_id}/download?access_token=<token>`
- строит callback URL как `/drive/onlyoffice/callback?file_id=<file_id>`
- вычисляет `documentType`, `fileType`, `document.key`, `permissions`, `editorConfig.mode`

Исходники:

- [src/presentation/pages/alemdrive/drive-src/pages/Editor.jsx](/d:/alem_project/alem-frontend/src/presentation/pages/alemdrive/drive-src/pages/Editor.jsx:208)
- [src/presentation/pages/alemdrive/drive-src/config/runtime.js](/d:/alem_project/alem-frontend/src/presentation/pages/alemdrive/drive-src/config/runtime.js:15)

## Фактический JS, который вызывает OnlyOffice

Это текущая web-логика:

```js
const downloadUrl = `${API_URL}/drive/files/${fileId}/download?access_token=${accessToken}`;
const docKey = file?.key || `${fileId}-v${file?.version || 1}`;

const config = {
  documentType: getOnlyOfficeDocumentType(file?.name, file?.mime_type),
  document: {
    fileType: fileType,
    key: docKey,
    title: file?.name || "Document",
    url: downloadUrl,
    permissions: {
      edit: canEdit,
      download: true,
      review: canEdit,
      comment: canEdit
    }
  },
  editorConfig: {
    callbackUrl: canEdit ? `${API_URL}/drive/onlyoffice/callback?file_id=${fileId}` : undefined,
    lang: "ru",
    mode: canEdit ? "edit" : "view",
    user: {
      id: String(currentUser.id),
      name: currentUser.full_name || currentUser.username || "User"
    },
    customization: {
      autosave: canEdit,
      forcesave: canEdit,
      features: {
        spellcheck: canEdit
      }
    }
  },
  height: "100%",
  width: "100%"
};

new window.DocsAPI.DocEditor(placeholder.id, config);
```

## Как вычисляется `documentType`

Логика:

- `cell` для `xls`, `xlsx`, `csv`, `ods` и spreadsheet mime types
- `slide` для `ppt`, `pptx`, `odp` и presentation mime types
- `word` для остального

Исходник:

- [src/presentation/pages/alemdrive/drive-src/config/runtime.js](/d:/alem_project/alem-frontend/src/presentation/pages/alemdrive/drive-src/config/runtime.js:28)

## Как frontend использует OnlyOffice

Этот раздел можно отдавать мобильной команде как описание текущего web-flow.

### Коротко

Frontend не запрашивает готовый OnlyOffice config через `GET /api/v1/drive/onlyoffice/config?file_id=...`.
Текущий web сам собирает `config` на клиенте и потом вызывает:

`new DocsAPI.DocEditor(containerId, config)`

### Пошаговый flow

1. Пользователь кликает по office-файлу в Drive.
2. Frontend открывает роут:
   `/drive/editor/<FILE_ID>`
3. Перед инициализацией редактора frontend проверяет права:
   `GET /api/v1/drive/permissions/my?resource_id=<FILE_ID>&resource_type=file`
4. Если метаданные файла не были переданы при переходе, frontend запрашивает:
   `GET /api/v1/drive/files/<FILE_ID>`
5. Frontend сам строит URL документа для OnlyOffice:
   `GET /api/v1/drive/files/<FILE_ID>/download?access_token=<ACCESS_TOKEN>`
6. Если файл можно редактировать, frontend сам строит callback URL:
   `GET /api/v1/drive/onlyoffice/callback?file_id=<FILE_ID>`
7. Frontend вычисляет `documentType`, `fileType`, `document.key`, `permissions`, `editorConfig.mode`
8. После этого frontend вызывает:
   `new DocsAPI.DocEditor(..., config)`

### Как определяется режим

- `owner` или `editor` -> `mode: "edit"` и `permissions.edit: true`
- `viewer` -> `mode: "view"` и `permissions.edit: false`

### Как frontend собирает OnlyOffice config

```json
{
  "documentType": "word|cell|slide",
  "document": {
    "fileType": "docx|xlsx|pptx",
    "key": "<file.key или <file_id>-v<version>>",
    "title": "<file.name>",
    "url": "https://<server-domain>/api/v1/drive/files/<FILE_ID>/download?access_token=<ACCESS_TOKEN>",
    "permissions": {
      "edit": true,
      "download": true,
      "review": true,
      "comment": true
    }
  },
  "editorConfig": {
    "callbackUrl": "https://<server-domain>/api/v1/drive/onlyoffice/callback?file_id=<FILE_ID>",
    "lang": "ru",
    "mode": "edit|view",
    "user": {
      "id": "<user_id>",
      "name": "<full_name>"
    }
  }
}
```

### Важные детали для mobile

- Отдельного `GET /api/v1/drive/onlyoffice/config?file_id=...` в текущем web-flow нет.
- Токен не кладётся отдельным полем в config.
- Авторизация загрузки файла идёт через `access_token` в `document.url`.
- `document.key` должен быть стабильным для версии файла.
- Если backend отдает поле `key`, frontend использует его.
- Если поля `key` нет, frontend использует fallback: `<file_id>-v<version>`.
- `callbackUrl` нужен только для режима редактирования.

### Готовый текст для мобильной команды

```md
Сейчас frontend использует OnlyOffice не через отдельный endpoint `GET /api/v1/drive/onlyoffice/config`, а собирает config на клиенте.

Flow такой:

1. При клике на office-файл открывается:
   `/drive/editor/<FILE_ID>`
2. Frontend проверяет права:
   `GET /api/v1/drive/permissions/my?resource_id=<FILE_ID>&resource_type=file`
3. Если нужно, frontend получает файл:
   `GET /api/v1/drive/files/<FILE_ID>`
4. Frontend сам строит `document.url`:
   `GET /api/v1/drive/files/<FILE_ID>/download?access_token=<ACCESS_TOKEN>`
5. Для edit-mode frontend сам строит `editorConfig.callbackUrl`:
   `GET /api/v1/drive/onlyoffice/callback?file_id=<FILE_ID>`
6. После этого frontend вызывает:
   `new DocsAPI.DocEditor(..., config)`

Структура config:

```json
{
  "documentType": "word|cell|slide",
  "document": {
    "fileType": "docx|xlsx|pptx",
    "key": "<file.key или <file_id>-v<version>>",
    "title": "<file.name>",
    "url": "https://<server-domain>/api/v1/drive/files/<FILE_ID>/download?access_token=<ACCESS_TOKEN>",
    "permissions": {
      "edit": true,
      "download": true,
      "review": true,
      "comment": true
    }
  },
  "editorConfig": {
    "callbackUrl": "https://<server-domain>/api/v1/drive/onlyoffice/callback?file_id=<FILE_ID>",
    "lang": "ru",
    "mode": "edit|view",
    "user": {
      "id": "<user_id>",
      "name": "<full_name>"
    }
  }
}
```
```
