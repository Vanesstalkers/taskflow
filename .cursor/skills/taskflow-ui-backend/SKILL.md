---
name: taskflow-ui-backend
description: >-
  When editing Taskflow frontend, prefers existing Vue components that already
  call backend RPC (updateField, updateLink, addObject) via storeActions. Covers
  reference data (lst), task creation rules (addObject, taskType schemas, TaskForm
  registry), and checking domain/collections before introducing new entities. Use when
  adding forms, fields, task UI, new task types, collections, dictionaries, Metacom
  API usage, Pinia patches, or MongoDB persistence. New task types: must verify via
  backend/scripts/metacom-integration.js (see skill body). Confirm new/changed files
  exist on disk (list/glob), not only Read/git status, before finishing. Any nested `collection:` in
  task schemas must have a matching `domain/collections/<name>.js` file on disk.
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

### Почему недостаточно «просмотреть каталог» и интеграционного скрипта

При типе задачи с вложенной связью (`created…Links`, `…List` и т.п.) в схеме почти всегда есть блок вида **`{ collection: 'имя', schema: domain.collections.имя.schema() }`**. Рантайм поднимает **`domain.collections.имя`** только из файла **`backend/application/domain/collections/имя.js`** (не из `collections/task/` и не из текста `metacom-integration.js`). Если этого файла нет, **`domain.collections.имя`** будет **`undefined`**, и первый же **`getUserTaskList` / `getTask`** упадёт с **`Cannot read properties of undefined (reading 'schema')`** — даже если задача уже создана в MongoDB.

Типичный промах агента: добавили **`collections/task/createSubdivision.js`**, **`taskTypes`**, фронт и ветку в **`metacom-integration.js`** (там уже фигурирует `collection: 'subdivision'`), но **не добавили** **`collections/subdivision.js`**, потому что:

1. Правило «проверь `collections/` перед новой сущностью» воспринимается как **поиск дубликата**, а не как **инвентаризация всех имён `collection` в новой схеме**.
2. Наличие **`subdivision`** в скрипте интеграции **не гарантирует** наличие доменного модуля коллекции — скрипт только вызывает RPC с строкой имени коллекции.

**Обязательно перед завершением задачи:** для **каждой** строки **`collection: '…'`** в новой или изменённой схеме (`collections/task/*.js`, `collections/*.js`, вложенные `schema`) убедиться, что существует файл **`backend/application/domain/collections/<то же имя>.js`** с **`schema()`** (и при необходимости **`search`** `{ fields, title, join }`, **`uniqueKey`**). Если файла нет — **создать** его по образцу **`user.js`**, **`pp.js`**, **`doc.js`** или расширить существующую коллекцию осознанно, а не оставлять «висячую» ссылку.

### Не полагаться только на `Read` и `git status` для «уже созданных» файлов

Успешный **`Read`** пути и строка **`??` в `git status`** **не доказывают**, что файл реально лежит на диске в рабочей копии: возможны несохранённый буфер редактора, другой корень workspace, устаревший статус, рассинхрон с тем, откуда читает запущенный **`node server`**.

**Обязательно** при добавлении нового типа задачи и связанных коллекций **до** объявления шага завершённым:

1. **Проверить фактическое наличие** ожидаемых путей инструментом, который смотрит на ФС (например листинг каталога **`collections/`**, **`collections/task/`**, **`frontend/src/components/tasks/`**, или поиск по маске), а не только «прочитать путь и надеяться».
2. Если какого‑то файла из чеклиста типа задачи нет — **создать** его в этом же заходе, а не править один слой (например только **`taskTypes.js`**) под предположение, что остальное уже сделано.

Иначе интеграция или **`addObject(task)`** дадут **`500`** / **`undefined` у схемы**, хотя по ощущению «всё уже было в проекте».

### Уточнение у пользователя при неоднозначности модели данных

Если после просмотра **`domain/collections/`**, **`domain/lst/`** и схем задач **`collections/task/`** остаётся **неоднозначность**, которую из кода не снять (типичные примеры: **новая коллекция MongoDB** vs **поля на документе `task`** vs **вложенная схема по `collection` + мапа** vs **только статический справочник `lst`** vs **расширение существующего `lst`**; нужна ли **запись в БД после согласования** или достаточно задачи как черновика; **одиночное значение** vs **список** и т.п.) — **сначала задать пользователю короткие уточняющие вопросы** с вариантами (2–4 пункта), **не выбирать молча «разумный по умолчанию»**, если выбор меняет контракт хранения, справочники или жизненный цикл данных. Реализацию начинать после ответа или при явном разрешении «делай минимальный вариант X».

## Где лежит общая логика RPC

- `frontend/src/utils/storeActions.js` — **`saveField`** → `api.core.updateField` с объектом **`data: { [имяПоля]: value, … }`** (одно или несколько полей за запрос), **`updateLink`** → `api.core.updateLink`, **`addObject`** → `api.core.addObject`; проверка `status === 'ok'`.
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
- **Как подключается `domain.collections.task[code]` (отдельного реестра нет):** рантайм **Impress** строит объект **`domain`** из дерева каталога **`application/domain/`**: вложенные папки становятся вложенными свойствами (`collections` → `domain.collections`, подпапка `task` → **`domain.collections.task`**). Каждый файл **`collections/task/<code>.js`** попадает в этот объект под ключом **`<code>`** — это **имя файла без `.js`**, в **camelCase**, как в обычных именах модулей Node (пример: файл **`addUser.js`** → **`domain.collections.task.addUser`**). Достаточно положить новый файл в **`backend/application/domain/collections/task/`** и перезапустить приложение: отдельно регистрировать тип в каком-то списке на бэкенде не нужно.
- В **`domain/lst/taskTypes.js`** у каждого типа **`code`** должен совпадать с ключом **`domain.collections.task[code]`** и со значением **`document.taskType`** с фронта (то есть с **именем файла** схемы без `.js`).
- При необходимости в модуле типа задаётся **`uniqueKey: ['поле', ...]`**.

### Правила именования `taskType` (один `code` на все слои)

Один и тот же идентификатор **`code`** / **`taskType`** (строка в **camelCase**, обычно начинается с **строчной** буквы) должен совпадать везде:

| Место | Правило |
|--------|--------|
| MongoDB, `addObject` | **`document.taskType`** = этот **`code`** |
| Справочник | В **`domain/lst/taskTypes.js`** у пункта **`code`** |
| Схема бэкенда | Имя файла **`backend/application/domain/collections/task/<code>.js`** (ключ **`domain.collections.task[code]`** = имя без `.js`) |
| Форма задачи | Имя Vue-файла в **`frontend/src/components/tasks/`** задаёт **`code`** через реестр (см. ниже) |

**Фронт (истина в коде — `frontend/src/components/tasks/registry.js`):** из имени файла без пути и без **`.vue`** берётся база в **PascalCase** (например `AddUser`, `RecruitmentRequest`, `CreateSubdivision`), затем **`taskType` = первая буква в нижнем регистре + остаток строки без изменений**: `base.charAt(0).toLowerCase() + base.slice(1)`.

Примеры:

- **`AddUser.vue`** → **`addUser`**
- **`RecruitmentRequest.vue`** → **`recruitmentRequest`**
- **`CreateSubdivision.vue`** → **`createSubdivision`**

Важно: это **не** «перевести всю фразу в lowerCamelCase с нуля» и **не** `toLowerCase()` по всему имени файла — меняется **только первый символ** базового имени. Имя компонента должно быть **PascalCase** (с заглавной первой буквы), иначе совпадение с ожидаемым **`taskType`** собьётся.

### Фронтенд: детальная панель и типо-специфичный UI

- **`TaskForm.vue`:** вкладка «Основное» — **`resolveTaskTypeMainComponent(task.taskType)`** из **`frontend/src/components/tasks/registry.js`**; значение **`task.taskType`** должно совпадать с **`code`** по таблице выше.
- Новый тип: Vue-файл в **`tasks/`** с именем по правилам предыдущего подраздела + пункт в **`taskTypes`** с тем же **`code`**.

### Чеклист нового типа задачи

| Слой | Действие |
|------|----------|
| Файлы на диске | Все пути из чеклиста **существуют в рабочей копии** (см. **«Не полагаться только на `Read` и `git status`»**). |
| Справочник | Пункт с **`code`** в **`domain/lst/taskTypes.js`**. |
| Схема | **`domain/collections/task/<тип>.js`** с **`schema()`** (и при необходимости **`uniqueKey`**). |
| Коллекции по ссылке | Для **каждого** значения **`collection:`** во вложенных полях схемы — файл **`domain/collections/<имя>.js`** существует и экспортирует **`schema()`** (см. подраздел **«Почему недостаточно…»**). |
| Создание | Тот же **`code`** в селекте (данные уже из `lst`). |
| Детали | **`frontend/src/components/tasks/<PascalCase>.vue`** → тот же **`code`**, что в схеме и в `taskTypes` (см. **«Правила именования `taskType`»**). |
| **Интеграционный прогон** | Обязательно: **`backend/scripts/metacom-integration.js`** (см. ниже). |

### Обязательное тестирование через `metacom-integration.js`

После добавления или изменения **типа задачи** (`taskType`), связанной с ним **схемы** `collections/task/<code>.js` или **типо-специфичного** создания связей (как у `addUser` / `createSubdivision`) агент **обязан** прогнать интеграционный скрипт и убедиться, что сценарий проходит без ошибок.

1. **Сервер** `node server` (backend) уже запущен, Metacom доступен (часто `ws://127.0.0.1:8001/api`, см. `frontend/vite.config.js`).
2. Из каталога **`backend`**: **`npm run integration:metacom`**. При вызове из shell агента учитывать ОС: в **Windows PowerShell** цепочка **`cd … && npm run …`** даёт синтаксическую ошибку — использовать **`Set-Location <путь-к-backend>; npm run integration:metacom`** (или два отдельных шага). В **bash** допустимо **`cd … && npm run integration:metacom`**.
   - **Без** переменных `TASKFLOW_LOGIN` / `TASKFLOW_PASSWORD`: скрипт делает **`auth.register`** нового пользователя и **посев всех** типов из `lst.taskTypes` с полезной нагрузкой для известных типов — новый **`code`** должен попасть в этот цикл; при необходимости **расширить** скрипт (ветка по `taskType` и связанные `addObject` / проверки в `assertSeedTaskIntegrity`), иначе новый тип не будет проверяться по данным.
   - С `TASKFLOW_LOGIN` + `TASKFLOW_PASSWORD` — узкий сценарий для одного `TASKFLOW_TASK_TYPE` (регрессия под существующую учётку).
3. При падении смотреть **`backend/log/last-integration-error.json`** и **`.txt`** (см. `.cursor/rules/taskflow-integration-log.mdc`).

Без успешного прогона (или явного согласования пользователя пропустить шаг) изменения по новому типу задачи **не считать завершёнными**.
