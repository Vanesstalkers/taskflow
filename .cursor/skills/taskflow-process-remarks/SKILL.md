---
name: taskflow-process-remarks
description: >-
  Processes pending UI remarks from MongoDB (remarks/getPendingRemarks), applies code
  fixes using dev-anchor-manifest, marks remarks processed, verifies frontend build,
  and runs backend/scripts/metacom-integration.js for each affected taskType. Use when
  the user asks to process/handle remarks, UI feedback, pending замечания, or after
  implementing changes triggered by remark workflow.
---

# Taskflow: обработка замечаний пользователя

## Когда применять

- Пользователь просит **обработать замечания** / **pending remarks** / **UI-feedback**.
- После правок по замечанию — **завершить цикл** (сборка + интеграция + mark processed).

Дополнительно читай **`taskflow-ui-backend`** (компоненты, коллекции, схемы задач) и **`frontend/dev-anchor-manifest.json`** для якорей.

## Обязательный порядок (не пропускать шаги)

```
- [ ] 1. Забрать pending-замечания
- [ ] 2. Реализовать правки по каждому remark
- [ ] 3. Сборка фронтенда + anchors CI
- [ ] 4. Metacom integration по `context.taskType` из замечаний
- [ ] 5. Пометить замечания «на проверке» (`review`)
- [ ] 6. Убедиться: pending пуст, integration и build зелёные
```

---

## 1. Забрать замечания

Backend **должен быть запущен** (`node server` в `backend/`).

```bash
cd backend
npm run remarks:pending:json
```

Для каждого элемента `remarks[]` использовать:

| Поле | Назначение |
|------|------------|
| `comment` | Что хочет пользователь |
| `devId` / `partialDevId` | Якорь UI |
| `ui.file`, `ui.line` | Файл/строка |
| `domain.schemaFile`, `domain.lstFile` | Backend |
| `context.taskId`, `context.taskType` | Тип задачи (приоритет для integration) |

Если `count === 0` — сообщить пользователю и остановиться.

---

## 2. Реализовать правки

- Править **минимально** под `comment`; не рефакторить вокруг.
- Сверять **`dev-anchor-manifest.json`**, если `devId` неоднозначен.
- Новые поля в task UI — через **`Input` / `Select` / …** и `storeActions`, не сырой RPC.
- Новая коллекция в схеме → файл **`backend/application/domain/collections/<name>.js`** (см. `taskflow-ui-backend`).

### Граница правок на фронтенде (обязательно)

**Запрещено** менять общие Vue-компоненты (`frontend/src/components/*.vue` вне каталога задач): `Input`, `Select`, `ComplexBlock`, `TaskForm`, диалоги и т.п.

**Разрешено** на фронте — только компонент **конкретной задачи** по `context.taskType` / `ui.file`:

- каталог **`frontend/src/components/tasks/`**;
- файл **`{PascalCase(taskType)}.vue`** (например `addEmployee` → `AddEmployee.vue`), указанный в замечании;
- при необходимости — связанные **backend**-файлы (`domain/collections/`, `domain/lst/`, `collections/task/<taskType>.js`), если remark или схема этого требуют.

Если замечание нельзя закрыть без правки общего компонента — **не менять его в этом цикле**; описать пользователю блокер и что нужно вынести в отдельную задачу.

Зафиксировать **`context.taskType`** из каждого обработанного замечания (см. §4).

---

## 3. Проверка сборки фронтенда (обязательно)

Из каталога `frontend/`:

```bash
npm run build
npm run ci:anchors
```

- **`npm run build`** должен завершиться без ошибок (в т.ч. плагин `vite-plugin-dev-anchors` парсит `.vue`).
- **`ci:anchors`** — manifest совпадает с исходниками; при расхождении: `npm run anchors:gen` и снова `ci:anchors`.

При ошибке сборки — **исправить до** integration и mark processed.

---

## 4. Metacom integration (обязательно)

Скрипт: **`backend/scripts/metacom-integration.js`**  
NPM: `cd backend && npm run integration:metacom`

### Какие типы гонять

Источник истины — **задача, в рамках которой пользователь оставил замечание**:

1. Собрать **уникальный** список **`remark.context.taskType`** по всем обработанным замечаниям в сессии.
2. Если у замечания нет `context.taskType` — префикс **`devId`** до первой точки (scope формы, обычно совпадает с `taskType`).
3. Иначе — по фактически изменённым файлам: `frontend/src/components/tasks/<PascalCase>.vue` → camelCase (см. `taskflow-ui-backend`, правила именования `taskType`).

Не подставлять типы «из памяти» и не гонять integration для типов, которых нет в списке замечаний/правок.

### Сценарий посева (`seed`)

Для **каждого** `context.taskType` из списка задать сценарий в env **`TASKFLOW_INTEGRATION_TASK_TYPES`**: формат `код[:seed]` через запятую.

Допустимые значения **`seed`** — в скрипте (`SEED_KEYS`, функции `runIntegrationSeed` / `assertSeedTaskIntegrity`): `none`, `userChain`, `subdivisionLink`.

Как выбрать seed для конкретного типа из замечания:

1. Открыть **`backend/scripts/metacom-integration.js`** и посмотреть, какой сценарий посева соответствует связям этого типа.
2. Сверить схему **`domain/collections/task/<taskType>.js`** (какие `collection:` и связи нужны для полноценной задачи).
3. Если достаточно только создания задачи без посева связанных сущностей — **`none`** (или код без суффикса `:…`).

Подставлять в команды **реальные коды из `remarks[].context.taskType`**, не примеры из документации.

**bash / zsh:**

```bash
cd backend
TASKFLOW_INTEGRATION_TASK_TYPES='<taskType>:none' npm run integration:metacom
# несколько замечаний с разными контекстами:
TASKFLOW_INTEGRATION_TASK_TYPES='<taskTypeA>:none,<taskTypeB>:<seed>' npm run integration:metacom
```

**PowerShell:**

```powershell
Set-Location backend
$env:TASKFLOW_INTEGRATION_TASK_TYPES='<taskType из remark.context.taskType>:none'
npm run integration:metacom
```

По умолчанию скрипт регистрирует **нового** пользователя и прогоняет указанные типы. URL: `TASKFLOW_METACOM_URL` (по умолчанию `ws://127.0.0.1:8001/api`).

### Если integration упал

1. Прочитать **`backend/log/last-integration-error.json`** и **`last-integration-error.txt`** (см. правило `taskflow-integration-log`).
2. Исправить код/схему; повторить **build** (§3) и **integration** (§4).
3. Не вызывать `remarks:mark`, пока integration не зелёный. `mark` ставит статус **`review`** (не «готово»); пользователь закрывает в UI «Правки».

---

## 5. Пометить замечания обработанными

Только после успешных §3 и §4:

```bash
cd backend
npm run remarks:mark -- --all-pending
# или по id:
npm run remarks:mark -- <remarkId> [<remarkId2> ...]
```

Проверка:

```bash
npm run remarks:pending:json
# ожидается "count": 0 для обработанных id
```

---

## 6. Отчёт пользователю

Кратко:

- сколько замечаний обработано;
- что изменено (файлы / поведение);
- результат `npm run build` и `integration:metacom` (какие `context.taskType` из замечаний);
- что pending пуст (или какие id остались и почему).

---

## Анти-паттерны

- ❌ Закрыть remark без `npm run build`.
- ❌ Пропустить integration для `context.taskType` из замечания.
- ❌ Пометить `processed` при падении integration.
- ❌ Менять только фронт, если remark указывает на `domain/*.js` / `lst/*.js`.
- ❌ Править `Input.vue`, `Select.vue`, `ComplexBlock.vue` и другие общие компоненты — только `frontend/src/components/tasks/<TaskType>.vue` для замечания.

---

## Справка API

| Действие | API / скрипт |
|----------|----------------|
| Список pending | `remarks/getPendingRemarks`, `npm run remarks:pending:json` |
| Сохранение с UI | `remarks/saveRemark` (ПКМ по `data-dev-id`) |
| Агент → на проверке | `remarks/markRemarksProcessed`, `npm run remarks:mark` (статус `review`) |
| Список в UI | `remarks/getRemarks` |
| Повтор с UI | `remarks/resubmitRemark` (из `review` → `new`) |
| Откат с UI | `remarks/revertRemark` — «Вернуть как было», `revertRequested: true`, откатить правки по `devId` |
| Готово с UI | `remarks/setRemarkStatus` (`review` → `done`) |
| Якоря | `frontend/dev-anchor-manifest.json` |
