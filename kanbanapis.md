kanban

GET
/kanban/board/filtered
Get kanban board with filters

Parameters
Try it out
Name Description
user_id
integer
(query)
Filter by specific user ID

status
string
(query)
Filter by status (column name or key)

date
string
(query)
Filter by due date (YYYY-MM-DD format)

name
string
(query)
Filter by task name/title (partial match)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"background": {
"image_url": "string",
"mode": "string",
"preset_hex": "string",
"preset_id": "string"
},
"board": {
"created_at": "string",
"id": "string",
"name": "string",
"owner_id": 0,
"updated_at": "string"
},
"columns": [
{
"column": {
"board_id": "string",
"created_at": "string",
"id": "string",
"is_system": true,
"key": "string",
"name": "string",
"position": 0,
"updated_at": "string",
"user_id": 0
},
"tasks": [
{
"assignee_ids": [
0
],
"attachments": [
{
"created_at": "string",
"download_url": "string",
"file_name": "string",
"file_size": 0,
"id": "string",
"mime_type": "string",
"task_id": "string",
"uploaded_by": 0
}
],
"board_id": "string",
"column_id": "string",
"created_at": "string",
"created_by": 0,
"description": "string",
"due_at": "string",
"id": "string",
"labels": [
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
],
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"status": "string",
"subtasks": [
"string"
],
"time_spent_sec": 0,
"title": "string",
"updated_at": "string"
}
]
}
],
"members": [
{
"board_id": "string",
"full_name": "string",
"joined_at": "string",
"role": "string",
"user_id": 0
}
],
"sprints": [
{
"board_id": "string",
"created_at": "string",
"end_date": "string",
"id": "string",
"name": "string",
"start_date": "string",
"status": "string",
"updated_at": "string"
}
]
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
401
Unauthorized
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/boards
Получить список досок пользователя

Parameters
Try it out
No parameters
Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"created_at": "string",
"id": "string",
"name": "string",
"owner_id": 0,
"updated_at": "string"
}
]
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/boards
Создать новую доску

Parameters
Try it out
Name Description
request \*
object
(body)
Запрос на создание доски
Example Value
Model
{
"name": "string"
}
Parameter content type

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"created_at": "string",
"id": "string",
"name": "string",
"owner_id": 0,
"updated_at": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/boards/{id}
Получить детали доски (колонки, задачи, спринты)

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"background": {
"image_url": "string",
"mode": "string",
"preset_hex": "string",
"preset_id": "string"
},
"board": {
"created_at": "string",
"id": "string",
"name": "string",
"owner_id": 0,
"updated_at": "string"
},
"columns": [
{
"column": {
"board_id": "string",
"created_at": "string",
"id": "string",
"is_system": true,
"key": "string",
"name": "string",
"position": 0,
"updated_at": "string",
"user_id": 0
},
"tasks": [
{
"assignee_ids": [
0
],
"attachments": [
{
"created_at": "string",
"download_url": "string",
"file_name": "string",
"file_size": 0,
"id": "string",
"mime_type": "string",
"task_id": "string",
"uploaded_by": 0
}
],
"board_id": "string",
"column_id": "string",
"created_at": "string",
"created_by": 0,
"description": "string",
"due_at": "string",
"id": "string",
"labels": [
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
],
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"status": "string",
"subtasks": [
"string"
],
"time_spent_sec": 0,
"title": "string",
"updated_at": "string"
}
]
}
],
"members": [
{
"board_id": "string",
"full_name": "string",
"joined_at": "string",
"role": "string",
"user_id": 0
}
],
"sprints": [
{
"board_id": "string",
"created_at": "string",
"end_date": "string",
"id": "string",
"name": "string",
"start_date": "string",
"status": "string",
"updated_at": "string"
}
]
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

PUT
/kanban/boards/{id}
Обновить доску

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

request \*
object
(body)
Данные для обновления доски
Example Value
Model
{
"name": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"created_at": "string",
"id": "string",
"name": "string",
"owner_id": 0,
"updated_at": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
403
Forbidden
Example Value
Model
{
"additionalProp1": {}
}
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

DELETE
/kanban/boards/{id}
Удалить доску

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
403
Forbidden
Example Value
Model
{
"additionalProp1": {}
}
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/boards/{id}/background/image
Загрузить кастомное фото доски

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

file \*
file
(formData)
Файл для фона

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"image_url": "string",
"mode": "string",
"preset_hex": "string",
"preset_id": "string"
}

DELETE
/kanban/boards/{id}/background/image
Удалить кастомное фото доски

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"image_url": "string",
"mode": "string",
"preset_hex": "string",
"preset_id": "string"
}

GET
/kanban/boards/{id}/background/image/download
Скачать кастомное фото доски

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

Responses
Response content type

Code Description

PUT
/kanban/boards/{id}/background/preset
Установить preset-цвет доски

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

request \*
object
(body)
Данные цвета
Example Value
Model
{
"preset_id": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"image_url": "string",
"mode": "string",
"preset_hex": "string",
"preset_id": "string"
}

GET
/kanban/boards/{id}/labels
List labels for board

Parameters
Try it out
Name Description
id \*
string
(path)
Board ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
]

POST
/kanban/boards/{id}/labels
Create label for board

Parameters
Try it out
Name Description
id \*
string
(path)
Board ID

request \*
object
(body)
Label info
Example Value
Model
{
"color": "string",
"name": "string"
}
Parameter content type

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/boards/{id}/members
Добавить участников к доске

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

request \*
object
(body)
Список участников
Example Value
Model
{
"members": [
{
"role": "string",
"user_id": 0
}
]
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

DELETE
/kanban/boards/{id}/members/{userId}
Удалить участника с доски

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

userId \*
integer
(path)
ID пользователя

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
403
Forbidden
Example Value
Model
{
"additionalProp1": {}
}
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/boards/{id}/sprints
Создать новый спринт

Parameters
Try it out
Name Description
id \*
string
(path)
ID доски (UUID)

request \*
object
(body)
Данные спринта
Example Value
Model
{
"end_date": "string",
"name": "string",
"start_date": "string"
}
Parameter content type

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"board_id": "string",
"created_at": "string",
"end_date": "string",
"id": "string",
"name": "string",
"start_date": "string",
"status": "string",
"updated_at": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/columns
Создать колонку

Parameters
Try it out
Name Description
request \*
object
(body)
Данные колонки
Example Value
Model
{
"board_id": "string",
"name": "string"
}
Parameter content type

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"board_id": "string",
"created_at": "string",
"id": "string",
"is_system": true,
"key": "string",
"name": "string",
"position": 0,
"updated_at": "string",
"user_id": 0
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

PUT
/kanban/columns/{id}
Обновить колонку (название)

Parameters
Try it out
Name Description
id \*
string
(path)
ID колонки (UUID)

request \*
object
(body)
Данные обновления
Example Value
Model
{
"name": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"board_id": "string",
"created_at": "string",
"id": "string",
"is_system": true,
"key": "string",
"name": "string",
"position": 0,
"updated_at": "string",
"user_id": 0
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

DELETE
/kanban/columns/{id}
Удалить колонку

Parameters
Try it out
Name Description
id \*
string
(path)
ID колонки (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

PUT
/kanban/columns/{id}/move
Переместить колонку (изменить порядок)

Parameters
Try it out
Name Description
id \*
string
(path)
ID колонки (UUID)

request \*
object
(body)
Новая позиция
Example Value
Model
{
"new_position": 0
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

PUT
/kanban/comments/{id}
Обновить текст комментария

Parameters
Try it out
Name Description
id \*
string
(path)
ID комментария (UUID)

request \*
object
(body)
Новый текст
Example Value
Model
{
"content": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

DELETE
/kanban/comments/{id}
Удалить комментарий

Parameters
Try it out
Name Description
id \*
string
(path)
ID комментария (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

DELETE
/kanban/labels/{id}
Delete label

Parameters
Try it out
Name Description
id \*
string
(path)
Label ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}

GET
/kanban/org/stats
Get kanban statistics by organization unit

Parameters
Try it out
Name Description
state_body_id \*
integer
(query)
State body ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"closed_by": [
{
"closed_count": 0,
"full_name": "string",
"tasks": [
{
"board_id": "string",
"board_name": "string",
"closed_at": "string",
"task_id": "string",
"title": "string"
}
],
"user_id": 0
}
],
"projects": [
{
"board_id": "string",
"board_name": "string",
"statuses": [
{
"count": 0,
"status": "string"
}
],
"total_tasks": 0
}
],
"state_body_id": 0,
"summary": [
{
"count": 0,
"status": "string"
}
]
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
403
Forbidden
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/org/stats/access-check
Check whether current user can view organization kanban stats

Parameters
Try it out
Name Description
state_body_id \*
integer
(query)
State body ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"allowed": true,
"reason": "string",
"state_body_id": 0
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/org/stats/{state_body_id}/access
List users with access to organization kanban stats

Parameters
Try it out
Name Description
state_body_id \*
integer
(path)
State body ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"created_at": "string",
"full_name": "string",
"granted_by": 0,
"user_id": 0
}
]

POST
/kanban/org/stats/{state_body_id}/access
Grant access to organization kanban stats

Parameters
Try it out
Name Description
state_body_id \*
integer
(path)
State body ID

request \*
object
(body)
Request
Example Value
Model
{
"user_id": 0
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}

DELETE
/kanban/org/stats/{state_body_id}/access/{user_id}
Revoke access to organization kanban stats

Parameters
Try it out
Name Description
state_body_id \*
integer
(path)
State body ID

user_id \*
integer
(path)
User ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}

GET
/kanban/org/{state_body_id}/access
List users with kanban access to organization unit

Parameters
Try it out
Name Description
state_body_id \*
integer
(path)
State body ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"created_at": "string",
"full_name": "string",
"granted_by": 0,
"user_id": 0
}
]

POST
/kanban/org/{state_body_id}/access
Grant kanban access to organization unit

Parameters
Try it out
Name Description
state_body_id \*
integer
(path)
State body ID

request \*
object
(body)
Request
Example Value
Model
{
"user_id": 0
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}

DELETE
/kanban/org/{state_body_id}/access/{user_id}
Revoke kanban access to organization unit

Parameters
Try it out
Name Description
state_body_id \*
integer
(path)
State body ID

user_id \*
integer
(path)
User ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}

GET
/kanban/sprints
Получить список всех спринтов пользователя (со всех досок)

Parameters
Try it out
No parameters
Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"board_id": "string",
"created_at": "string",
"end_date": "string",
"id": "string",
"name": "string",
"start_date": "string",
"status": "string",
"updated_at": "string"
}
]
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/tasks
Создать новую задачу

Parameters
Try it out
Name Description
request \*
object
(body)
Данные задачи
Example Value
Model
{
"assignee_ids": [
0
],
"attachment_file_ids": [
"string"
],
"board_id": "string",
"description": "string",
"due_at": "string",
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"title": "string"
}
Parameter content type

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"assignee_ids": [
0
],
"attachments": [
{
"created_at": "string",
"download_url": "string",
"file_name": "string",
"file_size": 0,
"id": "string",
"mime_type": "string",
"task_id": "string",
"uploaded_by": 0
}
],
"board_id": "string",
"column_id": "string",
"created_at": "string",
"created_by": 0,
"description": "string",
"due_at": "string",
"id": "string",
"labels": [
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
],
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"status": "string",
"subtasks": [
"string"
],
"time_spent_sec": 0,
"title": "string",
"updated_at": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/tasks/my-todo
Мои задачи (TODO)

Получает все задачи пользователя, которые находятся в колонке TODO

Parameters
Try it out
No parameters
Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"assignee_ids": [
0
],
"attachments": [
{
"created_at": "string",
"download_url": "string",
"file_name": "string",
"file_size": 0,
"id": "string",
"mime_type": "string",
"task_id": "string",
"uploaded_by": 0
}
],
"board_id": "string",
"column_id": "string",
"created_at": "string",
"created_by": 0,
"description": "string",
"due_at": "string",
"id": "string",
"labels": [
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
],
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"status": "string",
"subtasks": [
"string"
],
"time_spent_sec": 0,
"title": "string",
"updated_at": "string"
}
]
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/tasks/search
Расширенный поиск задач (фильтры как в Jira)

Parameters
Try it out
Name Description
q
string
(query)
Текст для поиска (название/описание)

priorities
array[string]
(query)
Список приоритетов
assignee_ids
array[integer]
(query)
Список ID исполнителей
column_ids
array[string]
(query)
Список ID колонок (UUID)
board_id
string
(query)
ID доски (UUID)

date_from
string
(query)
Дата 'С' (RFC3339)

date_to
string
(query)
Дата 'По' (RFC3339)

Responses
Response content type

Code Description

POST
/kanban/tasks/upload
Загрузить файл для Kanban (без привязки к задаче)

Parameters
Try it out
Name Description
file \*
file
(formData)
Файл для загрузки

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"created_at": "string",
"download_url": "string",
"folder_id": "string",
"id": "string",
"key": "string",
"mime_type": "string",
"owner_fio": "string",
"owner_id": 0,
"real_name": "string",
"size": 0,
"updated_at": "string",
"version": 0
}
401
Unauthorized
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/tasks/{id}
Получить детали задачи

Возвращает полную информацию о задаче, включая исполнителей и вложения

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"assignee_ids": [
0
],
"attachments": [
{
"created_at": "string",
"download_url": "string",
"file_name": "string",
"file_size": 0,
"id": "string",
"mime_type": "string",
"task_id": "string",
"uploaded_by": 0
}
],
"board_id": "string",
"column_id": "string",
"created_at": "string",
"created_by": 0,
"description": "string",
"due_at": "string",
"id": "string",
"labels": [
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
],
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"status": "string",
"subtasks": [
"string"
],
"time_spent_sec": 0,
"title": "string",
"updated_at": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
403
Forbidden
Example Value
Model
{
"additionalProp1": {}
}
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

PUT
/kanban/tasks/{id}
Обновить задачу

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

request \*
object
(body)
Данные для обновления
Example Value
Model
{
"add_attachment_file_ids": [
"string"
],
"assignee_ids": [
0
],
"description": "string",
"due_at": "string",
"label_ids": [
"string"
],
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"status": "string",
"title": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"assignee_ids": [
0
],
"attachments": [
{
"created_at": "string",
"download_url": "string",
"file_name": "string",
"file_size": 0,
"id": "string",
"mime_type": "string",
"task_id": "string",
"uploaded_by": 0
}
],
"board_id": "string",
"column_id": "string",
"created_at": "string",
"created_by": 0,
"description": "string",
"due_at": "string",
"id": "string",
"labels": [
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
],
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"status": "string",
"subtasks": [
"string"
],
"time_spent_sec": 0,
"title": "string",
"updated_at": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

DELETE
/kanban/tasks/{id}
Удалить задачу

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/tasks/{id}/attachments
Прикрепить файл к задаче

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

request \*
object
(body)
ID файла
Example Value
Model
{
"file_id": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/tasks/{id}/comments
Получить все комментарии задачи

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"attachment_url": "string",
"author": {
"availability_status": "string",
"avatar_url": "string",
"bio": "string",
"created_at": "string",
"department_id": 0,
"deputy_prime_minister_id": 0,
"division_id": 0,
"email": "string",
"first_name": "string",
"full_name": "string",
"full_name_local": "string",
"id": 0,
"iin": "string",
"is_active": true,
"is_first_login": true,
"is_support": true,
"keycloak_id": "string",
"last_login_at": "string",
"last_name": "string",
"last_seen_at": "string",
"ministry_id": 0,
"position": "string",
"prime_minister_id": 0,
"role": "admin",
"state_body_id": 0,
"username": "string"
},
"content": "string",
"created_at": "string",
"id": "string",
"task_id": "string",
"updated_at": "string",
"user_id": 0
}
]
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/tasks/{id}/comments
Добавить комментарий к задаче

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

request \*
object
(body)
Текст комментария
Example Value
Model
{
"attachment_url": "string",
"content": "string"
}
Parameter content type

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"attachment_url": "string",
"author": {
"availability_status": "string",
"avatar_url": "string",
"bio": "string",
"created_at": "string",
"department_id": 0,
"deputy_prime_minister_id": 0,
"division_id": 0,
"email": "string",
"first_name": "string",
"full_name": "string",
"full_name_local": "string",
"id": 0,
"iin": "string",
"is_active": true,
"is_first_login": true,
"is_support": true,
"keycloak_id": "string",
"last_login_at": "string",
"last_name": "string",
"last_seen_at": "string",
"ministry_id": 0,
"position": "string",
"prime_minister_id": 0,
"role": "admin",
"state_body_id": 0,
"username": "string"
},
"content": "string",
"created_at": "string",
"id": "string",
"task_id": "string",
"updated_at": "string",
"user_id": 0
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/tasks/{id}/comments/photo
Загрузить фото и оставить комментарий

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

file
file
(formData)
Фото для комментария

content
string
(formData)
Текст комментария

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"attachment_url": "string",
"author": {
"availability_status": "string",
"avatar_url": "string",
"bio": "string",
"created_at": "string",
"department_id": 0,
"deputy_prime_minister_id": 0,
"division_id": 0,
"email": "string",
"first_name": "string",
"full_name": "string",
"full_name_local": "string",
"id": 0,
"iin": "string",
"is_active": true,
"is_first_login": true,
"is_support": true,
"keycloak_id": "string",
"last_login_at": "string",
"last_name": "string",
"last_seen_at": "string",
"ministry_id": 0,
"position": "string",
"prime_minister_id": 0,
"role": "admin",
"state_body_id": 0,
"username": "string"
},
"content": "string",
"created_at": "string",
"id": "string",
"task_id": "string",
"updated_at": "string",
"user_id": 0
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/tasks/{id}/files
Загрузить файл в задачу

Загружает файл в S3/MinIO и прикрепляет его к задаче

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

file \*
file
(formData)
Файл для загрузки

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"created_at": "string",
"download_url": "string",
"file_name": "string",
"file_size": 0,
"id": "string",
"mime_type": "string",
"task_id": "string",
"uploaded_by": 0
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

DELETE
/kanban/tasks/{id}/files/{fileId}
Удалить файл из задачи

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

fileId \*
string
(path)
ID файла (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/tasks/{id}/files/{fileId}/download
Скачать файл задачи

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

fileId \*
string
(path)
ID файла (UUID)

Responses
Response content type

Code Description
200
Поток файла
Example Value
Model
(no example available)
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/tasks/{id}/history
Получить историю изменений задачи (как в Jira)

Возвращает полную историю всех изменений задачи: создание, обновления, перемещения, назначения, удаления

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"action": "string",
"created_at": "string",
"field_name": "string",
"id": "string",
"metadata": {
"additionalProp1": {}
},
"new_value": "string",
"old_value": "string",
"task_id": "string",
"user_id": 0
}
]
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
403
Forbidden
Example Value
Model
{
"additionalProp1": {}
}
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/tasks/{id}/labels
Add label to task

Parameters
Try it out
Name Description
id \*
string
(path)
Task ID

request \*
object
(body)
Label ID
Example Value
Model
{
"label_id": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}

DELETE
/kanban/tasks/{id}/labels/{labelId}
Remove label from task

Parameters
Try it out
Name Description
id \*
string
(path)
Task ID

labelId \*
string
(path)
Label ID

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}

PUT
/kanban/tasks/{id}/move
Переместить задачу в другую колонку

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

request \*
object
(body)
Данные перемещения
Example Value
Model
{
"to_column_id": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"additionalProp1": "string",
"additionalProp2": "string",
"additionalProp3": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

PUT
/kanban/tasks/{id}/status
Обновить статус задачи (подзадачи)

Меняет статус на один из: К ВЫПОЛНЕНИЮ, В РАБОТЕ, В ПРОЦЕССЕ ПРОВЕРКИ, ГОТОВО

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

request \*
object
(body)
Новый статус
Example Value
Model
{
"status": "string"
}
Parameter content type

Responses
Response content type

Code Description
200
OK
Example Value
Model
{
"assignee_ids": [
0
],
"attachments": [
{
"created_at": "string",
"download_url": "string",
"file_name": "string",
"file_size": 0,
"id": "string",
"mime_type": "string",
"task_id": "string",
"uploaded_by": 0
}
],
"board_id": "string",
"column_id": "string",
"created_at": "string",
"created_by": 0,
"description": "string",
"due_at": "string",
"id": "string",
"labels": [
{
"board_id": "string",
"color": "string",
"created_at": "string",
"id": "string",
"name": "string"
}
],
"original_estimate_sec": 0,
"parent_id": "string",
"priority": "string",
"sprint_id": "string",
"status": "string",
"subtasks": [
"string"
],
"time_spent_sec": 0,
"title": "string",
"updated_at": "string"
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
403
Forbidden
Example Value
Model
{
"additionalProp1": {}
}
404
Not Found
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

GET
/kanban/tasks/{id}/worklogs
Список ворклогов задачи

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

Responses
Response content type

Code Description
200
OK
Example Value
Model
[
{
"comment": "string",
"created_at": "string",
"id": "string",
"started_at": "string",
"task_id": "string",
"time_spent_sec": 0,
"user_id": 0
}
]
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}

POST
/kanban/tasks/{id}/worklogs
Добавить ворклог к задаче

Parameters
Try it out
Name Description
id \*
string
(path)
ID задачи (UUID)

request \*
object
(body)
Данные ворклога
Example Value
Model
{
"comment": "string",
"created_at": "string",
"id": "string",
"started_at": "string",
"task_id": "string",
"time_spent_sec": 0,
"user_id": 0
}
Parameter content type

Responses
Response content type

Code Description
201
Created
Example Value
Model
{
"comment": "string",
"created_at": "string",
"id": "string",
"started_at": "string",
"task_id": "string",
"time_spent_sec": 0,
"user_id": 0
}
400
Bad Request
Example Value
Model
{
"additionalProp1": {}
}
500
Internal Server Error
Example Value
Model
{
"additionalProp1": {}
}
