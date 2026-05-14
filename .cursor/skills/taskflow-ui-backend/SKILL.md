---
name: taskflow-ui-backend
description: >-
  When editing Taskflow frontend, prefers existing Vue components that already
  call backend RPC (updateField, updateLink, addObject) via storeActions. Covers
  reference data (lst), task creation rules (addObject, taskType schemas, TaskForm
  registry), and checking domain/collections before introducing new entities. Use when
  adding forms, fields, task UI, new task types, collections, dictionaries, Metacom
  API usage, Pinia patches, or MongoDB persistence.
---

# Taskflow: UI и бэкенд через готовые компоненты

## Правило по умолчанию

При добавлении или изменении пользовательского ввода и сохранения данных **не писать с нуля** вызовы `getApi()?.core?.updateField` / `updateLink` / `addObject` в новых компонентах, если задачу можно решить существующими обёртками.

Сначала **подобрать готовый компонент** из `frontend/src/components/`, который уже связан с бэкендом, и расширить его пропсами/слотами только при необходимости.

## Перед добавлением новых сущностей в проект

**Обязательно** перед введением новой коллекции, новой доменной модели или дублирующей сущности:

1. Просмотреть уже описанные коллекции и схемы в **`backend/application/domain/collections/`** — в том числе **`user.js`**, **`doc.js`**, **`phone.js`**, **`pp.js`**, **`userRole.js`**, папку **`collections/task/`** (типизированные схемы задач). Убедиться, что нужные данные **ещё не живут** в существующей коллекции или во вложенной схеме (связи через `collection` + мапы вроде `userLinks` / `docLinks`).
2. Сверить с **`backend/application/domain/task.js`** (`defaultSchema`, связи) и с тем, как **`getTask`**, **`getUserTaskList`**, **`updateField`**, **`updateLink`**, **`ensureUniqueKeys`** опираются на **`domain.collections[collection]`** и **`domain.collections.task[taskType]`** — новая сущность не должна обходить эти контракты без необходимости.

Цель: не плодить параллельные коллекции и не дублировать поля, если задача решается расширением существующей схемы или связью.

## Где лежит общая логика RPC

- `frontend/src/utils/storeActions.js` — **`saveField`** → `api.core.updateField`, **`updateLink`** → `api.core.updateLink`, **`addObject`** → `api.core.addObject`; проверка `status === 'ok'`.
- Подписка на патчи стора: **`subscribeStoreUpdates`** (`api.core.on('updateStore', …)`). После успешных RPC сервер шлёт `core/updateStore`; отдельно дублировать обновление Pinia из каждого нового виджета не нужно, если сохранение идёт через эти пути.

## Какие компоненты использовать

| Задача | Компонент / паттерн |
|--------|---------------------|
| Текстовое поле с сохранением по blur / Ctrl+Enter | `Input.vue`, при необходимости `InputInline.vue` |
| Многострочный текст | `Textarea.vue` |
| Выбор из списка с сохранением | `Select.vue` |
| Переключатели-радио | `Radio.vue` |
| Флаги | `Checkbox.vue` |
| Файлы | `InputFile.vue` |
| Связи (мапы вроде `userLinks`), мульти-выбор, создание связанной сущности | `ComplexBlock.vue` (проп `persist`, `add`, см. использование в `CreateTaskDialog.vue`, `TaskForm.vue`) |
| Одноразовое создание документа (новая задача) | Диалог с вызовом **`getApi()?.core?.addObject`** по образцу `CreateTaskDialog.vue` (или обёртка вокруг `addObject` из `storeActions.js`) |

Передавайте в эти компоненты **`collection`**, **`_id`**, **`field`** (и прочие пропсы по их контракту), а не сырой Mongo-апдейт снаружи.

## Когда допустим прямой RPC

- Компонента с нужным поведением **нет** и добавление в существующий было бы раздуванием — тогда один раз вызывать методы из **`storeActions.js`**, а не дублировать `assertUpdateFieldOk` и разбор ответа.
- Особые сценарии (например **`taskMove`**, **`getTask`**, **`getUserTaskList`**) — по аналогии с уже существующими вызовами в `App.vue` / `TaskForm.vue`.

## Анти-паттерн

Дублировать в новом `.vue` файле логику «вызов `api.core.updateField` + ручной merge в store + своя обработка ошибок», если то же уже делает `Input` / `Select` / `saveField`.

## Справочники (`lst`)

### Бэкенд

- Данные справочников — **статический код**, не отдельная коллекция в MongoDB: файлы **`backend/application/domain/lst/<имя>.js`**, экспорт вида **`{ items: [...] }`** (часто `code` + `title`). Имя ключа в API = **имя файла без `.js`** (`taskTypes`, `genders`, `userRoles`, …), доступ: **`domain.lst[имя].items`**.
- Связь поля схемы с справочником: в **`domain/collections/*.js`** (и схемах **`domain/collections/task/<тип>.js`**) у поля задаётся **`{ lst: 'имяСправочника' }`**. Тогда при сборке ответов бэкенд знает, какие справочники приложить.
- **Пакетом с данными:** `getUserTaskList`, `getTask` собирают множество имён из схем (в т.ч. вложенных коллекций) и возвращают **`lst: { [имя]: items[] }`**. Для пустого списка задач в коде явно подмешивается **`taskTypes`**, чтобы доска и диалог создания имели типы.
- **Точечно:** **`api.core.getLst`** (`backend/application/api/core/getLst.js`) — аргумент **`{ name }`**, ответ **`{ items }`**.

### Фронтенд

- Справочники лежат в Pinia: **`useStore().lst`** — объект **`{ [имяСправочника]: массивПунктов }`**. Обновление через **`setData({ lst, store })`** при ответах `getUserTaskList`, `getTask` и т.п.; не дублировать отдельный «список стран» без причины.
- Ленивая подгрузка: **`store.fetchLst({ name, getLst })`** в `frontend/src/stores/store.js` вызывает **`getLst`** и пишет в **`lst[name]`**, флаги — **`lstLoading[name]`**. Использовать, если справочник нужен до прихода пакетного `lst` или для редкого имени.
- В UI: у **`Select`**, **`Radio`**, **`ComplexBlock`** (проп **`list.lstName`** / **`lst-name`**) задавать **`lstName`**, равное имени файла в `domain/lst` — компонент читает **`globalStore.lst[lstName]`**. Явный **`items`** в пропах имеет приоритет, если нужен разовый список.
- Подписи к кодам (например тип задачи на карточке) — через **`globalStore.lst.<имя>`** и маппинг `code` → `title`, как в **`App.vue`** / **`CreateTaskDialog.vue`**.

### Что делать при новом справочнике

1. Добавить **`backend/application/domain/lst/<имя>.js`** с **`items`**.
2. Привязать поле в схеме коллекции через **`lst: '<имя>'`**, чтобы **`getTask` / `getUserTaskList`** подтягивали его автоматически.
3. На фронте использовать **`lstName: '<имя>'`** или читать **`store.lst.<имя>`** после **`setData`**; при необходимости вызывать **`fetchLst`** с **`getApi()?.core?.getLst`**.

## Сущность «задача»: правила на уровне кода (создание и новый тип)

### Контракт `addObject` для коллекции `task`

- **`collection`:** `'task'`.
- **`document`:** минимум **`title`** (непустой после trim; в UI — правила и лимит в **`CreateTaskDialog.vue`**), **`taskType`** (строка **`code`** из **`domain/lst/taskTypes.js`**), **`status`:** при создании из текущего UI — **`'todo'`** (канбан в **`App.vue`**: `todo` / `inProgress` / `done`).
- **`userLinks`:** объект **`{ [userId]: {} }`**; в диалоге — **не менее одного** исполнителя, иначе submit блокируется. Для попадания задачи в **`getUserTaskList`** у текущего пользователя его **`userId` должен быть ключом в `userLinks`** (в диалоге по умолчанию подставляется текущий пользователь).
- **`docLinks`** в диалоге создания не передаётся; при необходимости задаётся позже из **`TaskForm.vue`** (вкладка «Файлы»).
- Сервер в **`addObject`** может дополнять **`creator`**, **`createdAt`** и т.д. Уникальность полей при вставке — **`domain/collections/utils/ensureUniqueKeys.js`**: для задач читается **`domain.collections.task[document.taskType].uniqueKey`** (если не задан — пустой массив).

### Верстка и UI создания

- **`CreateTaskDialog.vue`:** `v-form` + **`submit` с `validate()`**; название (`v-text-field`), тип (`v-select`, `item-value="code"`, пункты из **`store.lst.taskTypes`**), исполнители — **`ComplexBlock`** с **`persist: { collection: 'user' }`**, **`add: { addType: 'search' }`**, без `parentId` (задачи ещё нет). При открытии: сброс валидации, выбор первого типа при необходимости, **`assigneeUserIds`** по умолчанию с текущим пользователем.
- Кнопка открытия — по образцу **`App.vue`** + **`CreateTaskDialog`**.

### Бэкенд: схема типа задачи

- Базовые поля — **`domain/task.js`** → **`defaultSchema`**.
- Для каждого **`taskType`** нужен модуль **`backend/application/domain/collections/task/<имя>.js`**, доступный как **`domain.collections.task[taskType]`**, с **`schema()`** (расширение через `...domain.task.defaultSchema`). Иначе ломаются **`getUserTaskList`**, **`getTask`**, **`updateField`**, **`updateLink`**, **`ensureUniqueKeys`**.
- В **`domain/lst/taskTypes.js`** у каждого типа **`code`** должен совпадать с ключом **`domain.collections.task[code]`** и со значением **`document.taskType`** с фронта.
- При необходимости в модуле типа задаётся **`uniqueKey: ['поле', ...]`**.

### Фронтенд: детальная панель и типо-специфичный UI

- **`TaskForm.vue`:** вкладка «Основное» — **`resolveTaskTypeMainComponent(task.taskType)`** из **`frontend/src/components/tasks/registry.js`**.
- Соглашение: файл **`frontend/src/components/tasks/<PascalCase>.vue`** → **`taskType`** = имя с **первой буквой в нижнем регистре** (пример: **`AddUser.vue`** → **`addUser`**). Новый тип задачи = новый Vue-файл в **`tasks/`** по этому правилу + запись в **`taskTypes`**.

### Чеклист нового типа задачи

| Слой | Действие |
|------|----------|
| Справочник | Пункт с **`code`** в **`domain/lst/taskTypes.js`**. |
| Схема | **`domain/collections/task/<тип>.js`** с **`schema()`** (и при необходимости **`uniqueKey`**). |
| Создание | Тот же **`code`** в селекте (данные уже из `lst`). |
| Детали | **`frontend/src/components/tasks/<Имя>.vue`** (PascalCase → тот же **`code`** по **`registry.js`**). |
