<template>
  <v-app class="app-root">
    <v-main class="app-main" scrollable>
      <v-container class="app-content py-8">
        <div class="d-flex align-center justify-space-between mb-4">
          <div>
            <h1 class="text-h4 mb-1">Taskflow Kanban</h1>
            <p class="text-body-2 text-medium-emphasis">Статус backend: {{ status }}</p>
          </div>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="dialog = true"> Новая задача </v-btn>
        </div>

        <v-alert v-if="errorText" type="error" variant="tonal" class="mb-4">
          {{ errorText }}
        </v-alert>

        <v-row>
          <v-col v-for="column in columns" :key="column.id" cols="12" md="4">
            <v-card class="column-card" variant="tonal">
              <v-card-title class="d-flex align-center justify-space-between">
                <span>{{ column.title }}</span>
                <v-chip size="small" color="primary" variant="outlined">
                  {{ tasksByStatus[column.id].length }}
                </v-chip>
              </v-card-title>
              <v-divider />
              <v-card-text class="column-body">
                <v-card v-for="task in tasksByStatus[column.id]" :key="task.id" class="mb-3 task-card" variant="elevated">
                  <v-card-item class="task-card-main" @click="openTaskDetail(task)">
                    <v-card-title class="text-subtitle-1">{{ task.title }}</v-card-title>
                    <v-card-subtitle>{{ task.description || 'Без описания' }}</v-card-subtitle>
                    <div class="mt-2" @click.stop>
                      <v-chip size="x-small" variant="tonal">
                        {{ taskTypeLabelByValue.get(task.taskType || 'feature') || 'Фича' }}
                      </v-chip>
                    </div>
                  </v-card-item>
                </v-card>

                <p v-if="tasksByStatus[column.id].length === 0" class="text-body-2 text-medium-emphasis ma-2">
                  Пока нет задач
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <v-dialog v-model="dialog" max-width="560">
        <v-card>
          <v-card-title>Новая задача</v-card-title>
          <v-card-text>
            <v-text-field v-model="newTitle" label="Название" variant="outlined" class="mb-3" />
            <v-textarea v-model="newDescription" label="Описание" variant="outlined" rows="3" />
            <v-select
              v-model="newTaskType"
              label="Тип задачи"
              variant="outlined"
              class="mt-3"
              :items="taskTypeOptions"
              item-title="title"
              item-value="value"
              :disabled="creatingTask || taskTypeLoading"
              :loading="taskTypeLoading"
            />
            <v-autocomplete
              v-model="assigneeUserIds"
              v-model:search="assigneeSearch"
              label="Исполнитель"
              variant="outlined"
              class="mt-3"
              :items="assigneeOptions"
              :loading="assigneeLoading"
              :disabled="creatingTask"
              no-filter
              multiple
              chips
              closable-chips
              clearable
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="closeDialog">Отмена</v-btn>
            <v-btn color="primary" :loading="creatingTask" @click="addTask">Создать</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="authDialog" max-width="460" persistent>
        <v-card>
          <v-card-title>Вход в систему</v-card-title>
          <v-card-text>
            <v-alert v-if="authError" type="error" variant="tonal" class="mb-3">
              {{ authError }}
            </v-alert>
            <v-text-field
              v-model="authLogin"
              label="Логин"
              variant="outlined"
              class="mb-3"
              :disabled="authLoading"
              @keyup.enter="submitAuth"
            />
            <v-text-field
              v-model="authPassword"
              label="Пароль"
              type="password"
              variant="outlined"
              :disabled="authLoading"
              @keyup.enter="submitAuth"
            />
            <v-combobox
              v-model="authFullName"
              label="Имя (для регистрации)"
              variant="outlined"
              class="mt-3"
              :disabled="authLoading"
              multiple
              chips
              closable-chips
              clearable
              @keyup.enter="submitRegister"
            />
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" :disabled="authLoading" @click="submitRegister"> Зарегистрироваться </v-btn>
            <v-spacer />
            <v-btn color="primary" :loading="authLoading" @click="submitAuth">Войти</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-main>

    <v-navigation-drawer
      v-model="detailDrawer"
      location="end"
      :mobile="false"
      width="440"
      class="task-detail-drawer border-s"
    >
      <div v-if="selectedTask" class="task-detail-inner pa-4">
        <div class="d-flex align-start justify-space-between mb-4 ga-2">
          <div class="task-detail-header-text flex-grow-1 pe-2">
            <div class="d-flex flex-column align-start ga-2 align-self-stretch">
              <v-text-field
                v-if="editingTaskTitle"
                v-model="editTitle"
                ref="taskTitleFieldRef"
                density="compact"
                variant="outlined"
                hide-details="auto"
                class="task-detail-title-field"
                :disabled="committingTitle"
                autofocus
                @blur="commitTaskTitleEdit"
                @keydown.enter.prevent="commitTaskTitleEdit"
                @keydown.esc.prevent="cancelTaskTitleEdit"
              />
              <h2
                v-else
                class="text-h6 text-break task-detail-title-clickable"
                tabindex="0"
                role="button"
                title="Нажми, чтобы изменить"
                @click="startEditTaskTitle"
                @keydown.enter.prevent="startEditTaskTitle"
                @keydown.space.prevent="startEditTaskTitle"
              >
                {{ selectedTask.title || 'Без названия' }}
              </h2>
              <v-chip size="small" variant="tonal">
                {{ taskTypeLabelByValue.get(selectedTask.taskType || 'feature') || 'Фича' }}
              </v-chip>
            </div>
          </div>
          <v-btn variant="text" density="comfortable" icon class="flex-shrink-0" @click="closeTaskDetail">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
        <v-alert v-if="detailError" type="error" variant="tonal" class="mb-4" density="compact">
          {{ detailError }}
        </v-alert>
        <div class="d-flex align-center flex-wrap ga-2 mb-4">
          <v-btn
            size="small"
            variant="tonal"
            :disabled="!canMoveLeft(selectedTask.status) || movingTaskId === String(selectedTask.id) || savingTask"
            @click="moveTask(selectedTask.id, -1)"
          >
            Назад
          </v-btn>
          <v-btn
            size="small"
            color="primary"
            variant="tonal"
            :disabled="!canMoveRight(selectedTask.status) || movingTaskId === String(selectedTask.id) || savingTask"
            @click="moveTask(selectedTask.id, 1)"
          >
            Вперёд
          </v-btn>
          <v-chip v-if="columnTitleByStatusId[selectedTask.status]" size="small" variant="outlined" class="ms-auto">
            {{ columnTitleByStatusId[selectedTask.status] }}
          </v-chip>
        </div>
        <v-tabs v-model="taskDetailTab" bg-color="transparent" density="compact" class="task-detail-tabs mb-2">
          <v-tab value="main">Основное</v-tab>
          <v-tab value="assignees">Исполнители</v-tab>
        </v-tabs>
        <v-window v-model="taskDetailTab" class="task-detail-window mb-2">
          <v-window-item value="main">
            <v-textarea v-model="editDescription" label="Описание" variant="outlined" rows="4" :disabled="savingTask" />
          </v-window-item>
          <v-window-item value="assignees">
            <v-autocomplete
              v-model="editAssigneeUserIds"
              v-model:search="editAssigneeSearch"
              label="Исполнители"
              variant="outlined"
              :items="editAssigneeOptions"
              :loading="editAssigneeLoading"
              :disabled="savingTask"
              no-filter
              multiple
              chips
              closable-chips
              clearable
            />
          </v-window-item>
        </v-window>
        <div class="d-flex ga-2 mt-6">
          <v-btn variant="text" :disabled="savingTask" @click="closeTaskDetail">Закрыть</v-btn>
          <v-spacer />
          <v-btn color="primary" :loading="savingTask" @click="saveTaskDetail">Сохранить</v-btn>
        </div>
      </div>
    </v-navigation-drawer>
  </v-app>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { initBackend } from './api/backend.js';
import { subscribeStoreUpdates } from './api/storeUpdates.js';
import { useTasksStore } from './stores/tasks.js';

const status = ref('Инициализация...');
const errorText = ref('');
const dialog = ref(false);
const newTitle = ref('');
const newDescription = ref('');
const newTaskType = ref('feature');
const taskTypeOptions = ref([
  { title: 'Фича', value: 'feature' },
  { title: 'Баг', value: 'bug' },
  { title: 'Улучшение', value: 'improvement' },
  { title: 'Исследование', value: 'research' },
  { title: 'Техдолг', value: 'chore' },
]);
const taskTypeLoading = ref(false);
const assigneeUserIds = ref([]);
const assigneeOptions = ref([]);
const assigneeSearch = ref('');
const assigneeLoading = ref(false);
const creatingTask = ref(false);
const detailDrawer = ref(false);
const selectedTaskId = ref('');
const editDescription = ref('');
const editingTaskTitle = ref(false);
const editTitle = ref('');
const taskTitleFieldRef = ref(null);
const committingTitle = ref(false);
const editAssigneeUserIds = ref([]);
const editAssigneeOptions = ref([]);
const editAssigneeSearch = ref('');
const editAssigneeLoading = ref(false);
const savingTask = ref(false);
const detailError = ref('');
const taskDetailTab = ref('main');
const movingTaskId = ref('');
const authDialog = ref(false);
const authLoading = ref(false);
const authLogin = ref('');
const authPassword = ref('');
const authFullName = ref([]);
const authError = ref('');
const tasksStore = useTasksStore();
let api = null;
let authResolve = null;

const columns = [
  { id: 'todo', title: 'To Do' },
  { id: 'inProgress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

const columnTitleByStatusId = Object.fromEntries(columns.map((column) => [column.id, column.title]));

const taskList = computed(() => Object.values(tasksStore.store.task));

const tasksByStatus = computed(() => ({
  todo: taskList.value.filter((task) => task.status === 'todo'),
  inProgress: taskList.value.filter((task) => task.status === 'inProgress'),
  done: taskList.value.filter((task) => task.status === 'done'),
}));

const getColumnIndex = (statusId) => columns.findIndex((column) => column.id === statusId);

const canMoveLeft = (statusId) => getColumnIndex(statusId) > 0;
const canMoveRight = (statusId) => getColumnIndex(statusId) < columns.length - 1;
const currentUserId = computed(() => String(tasksStore.store.currentUserId || ''));
const getTaskMoveMethod = () => api?.core?.taskMove;
const getTasksListMethod = () => api?.core?.tasksList;
const getTaskCreateMethod = () => api?.core?.mongoInsertOne;
const getUsersMethod = () => api?.auth?.users;
const getTaskTypesMethod = () => api?.core?.taskTypes;
/**
 * Вызов метода backend/application/api/core/updateField.js (через Metacom api.core.updateField).
 * @param {{ collection: string, id: string, field: string, value: unknown }} params
 */
const callUpdateField = (params) => {
  const method = api?.core?.updateField;
  if (!method) {
    return Promise.reject(new Error('API updateField недоступен'));
  }
  return method({
    collection: params.collection,
    id: String(params.id),
    field: params.field,
    value: params.value,
  });
};

const selectedTask = computed(() => {
  const id = selectedTaskId.value;
  if (!id) return null;
  return tasksStore.store.task[id] || null;
});

const taskTypeLabelByValue = computed(
  () => new Map(taskTypeOptions.value.map((option) => [option.value, option.title])),
);

const moveTask = async (id, step) => {
  const taskMove = getTaskMoveMethod();
  if (!taskMove) {
    errorText.value = 'API taskMove недоступен';
    return;
  }
  const task = tasksStore.store.task[id];
  if (!task) return;
  const direction = step > 0 ? 'forward' : 'backward';
  errorText.value = '';
  movingTaskId.value = String(id);
  try {
    await taskMove({
      id: String(id),
      direction,
    });
  } catch (error) {
    errorText.value = `Ошибка обновления статуса: ${error.message}`;
  } finally {
    movingTaskId.value = '';
  }
};

const closeDialog = () => {
  dialog.value = false;
  newTitle.value = '';
  newDescription.value = '';
  newTaskType.value = 'feature';
  assigneeSearch.value = '';
  if (currentUserId.value) {
    assigneeUserIds.value = [currentUserId.value];
  }
};

const userLinksFromAssigneeIds = (ids) =>
  Object.fromEntries(ids.map((userId) => [String(userId), {}]).filter(([userId]) => userId));

const assigneeIdsSignature = (ids) =>
  [...ids].map(String).filter(Boolean).sort().join(',');

const startEditTaskTitle = async () => {
  if (savingTask.value || committingTitle.value) return;
  const task = selectedTask.value;
  if (!task) return;
  editTitle.value = task.title || '';
  editingTaskTitle.value = true;
  await nextTick();
  const field = taskTitleFieldRef.value;
  const input = field?.$el?.querySelector?.('input');
  if (input) {
    input.focus();
    input.select();
  } else {
    field?.focus?.();
  }
};

const cancelTaskTitleEdit = () => {
  editingTaskTitle.value = false;
};

const commitTaskTitleEdit = async () => {
  if (!editingTaskTitle.value || committingTitle.value) return;
  const id = selectedTaskId.value;
  const task = tasksStore.store.task[id];
  const next = editTitle.value.trim();
  const prev = (task?.title || '').trim();
  editingTaskTitle.value = false;
  if (next === prev) return;
  if (!next) {
    detailError.value = 'Название не может быть пустым';
    return;
  }
  if (!task) {
    detailError.value = 'Задача не найдена';
    return;
  }
  detailError.value = '';
  committingTitle.value = true;
  try {
    await callUpdateField({ collection: 'task', id, field: 'title', value: next });
    task.title = next;
  } catch (error) {
    detailError.value = error.message || 'Не удалось сохранить название';
  } finally {
    committingTitle.value = false;
  }
};

const openTaskDetail = (task) => {
  detailError.value = '';
  editingTaskTitle.value = false;
  selectedTaskId.value = String(task.id);
  editDescription.value = task.description || '';
  const linkIds = Object.keys(task.userLinks || {}).filter(Boolean);
  editAssigneeUserIds.value = linkIds.length > 0 ? linkIds : currentUserId.value ? [currentUserId.value] : [];
  editAssigneeSearch.value = '';
  detailDrawer.value = true;
};

const closeTaskDetail = () => {
  detailDrawer.value = false;
  detailError.value = '';
  taskDetailTab.value = 'main';
  selectedTaskId.value = '';
  editAssigneeSearch.value = '';
  editingTaskTitle.value = false;
};

const loadEditUsers = async (search = '') => {
  const appendSelectedUsers = (items) => {
    const map = new Map(items.map((item) => [String(item.value), item]));
    for (const userId of editAssigneeUserIds.value) {
      const key = String(userId);
      if (map.has(key)) continue;
      const user = tasksStore.store.user[key];
      if (!user) continue;
      map.set(key, {
        title: user.fullName ? `${user.fullName} (${user.login})` : user.login,
        value: key,
      });
    }
    return Array.from(map.values());
  };

  if (!search) {
    const currentUser = tasksStore.store.user[currentUserId.value];
    const items = currentUser
      ? [
          {
            title: currentUser.fullName ? `${currentUser.fullName} (${currentUser.login})` : currentUser.login,
            value: currentUserId.value,
          },
        ]
      : [];
    editAssigneeOptions.value = appendSelectedUsers(items);
    return;
  }
  const usersMethod = getUsersMethod();
  if (!usersMethod) return;
  editAssigneeLoading.value = true;
  try {
    const response = await usersMethod({ search, limit: 20 });
    const users = Array.isArray(response?.users) ? response.users : [];
    const items = users.map((user) => ({
      title: user.fullName ? `${user.fullName} (${user.login})` : user.login,
      value: String(user.userId),
    }));
    editAssigneeOptions.value = appendSelectedUsers(items);
    for (const user of users) {
      tasksStore.store.user[String(user.userId)] = user;
    }
  } catch {
    // Keep previous options on transient request errors.
  } finally {
    editAssigneeLoading.value = false;
  }
};

const saveTaskDetail = async () => {
  const id = selectedTaskId.value;
  const task = tasksStore.store.task[id];
  if (!task) {
    detailError.value = 'Задача не найдена';
    return;
  }
  if (!api?.core?.updateField) {
    detailError.value = 'API updateField недоступен';
    return;
  }
  if (!(task.title || '').trim()) {
    detailError.value = 'У задачи нет названия';
    return;
  }
  const assigneeIds = editAssigneeUserIds.value.map((value) => String(value)).filter(Boolean);
  if (assigneeIds.length === 0) {
    detailError.value = 'Нужен хотя бы один исполнитель';
    return;
  }
  detailError.value = '';
  savingTask.value = true;
  try {
    const nextDescription = editDescription.value.trim();
    const nextLinks = userLinksFromAssigneeIds(assigneeIds);
    if (nextDescription !== (task.description || '')) {
      await callUpdateField({ collection: 'task', id, field: 'description', value: nextDescription });
    }
    const prevSig = assigneeIdsSignature(Object.keys(task.userLinks || {}));
    const nextSig = assigneeIdsSignature(assigneeIds);
    if (prevSig !== nextSig) {
      await callUpdateField({ collection: 'task', id, field: 'userLinks', value: nextLinks });
    }
  } catch (error) {
    detailError.value = error.message || 'Не удалось сохранить';
  } finally {
    savingTask.value = false;
  }
};

const addTask = async () => {
  if (!newTitle.value.trim()) {
    errorText.value = 'Укажи название задачи';
    return;
  }
  errorText.value = '';
  const createTask = getTaskCreateMethod();
  if (!createTask) {
    errorText.value = 'API mongoInsertOne недоступен';
    return;
  }

  creatingTask.value = true;
  try {
    const selectedAssigneeIds = assigneeUserIds.value.map((value) => String(value)).filter(Boolean);
    const userLinks = Object.fromEntries(selectedAssigneeIds.map((userId) => [userId, {}]));
    await createTask({
      collection: 'task',
      document: {
        title: newTitle.value.trim(),
        description: newDescription.value.trim(),
        taskType: String(newTaskType.value || 'feature'),
        status: 'todo',
        userLinks,
      },
    });
    closeDialog();
  } catch (error) {
    errorText.value = `Ошибка создания задачи: ${error.message}`;
  } finally {
    creatingTask.value = false;
  }
};

const loadTaskTypes = async () => {
  const taskTypesMethod = getTaskTypesMethod();
  if (!taskTypesMethod) return;
  taskTypeLoading.value = true;
  try {
    const response = await taskTypesMethod();
    const taskTypes = Array.isArray(response?.taskTypes) ? response.taskTypes : [];
    const normalizedOptions = taskTypes
      .map((taskType) => ({
        title: String(taskType?.title || '').trim(),
        value: String(taskType?.id || '').trim(),
      }))
      .filter((taskType) => taskType.title && taskType.value);
    if (normalizedOptions.length > 0) {
      taskTypeOptions.value = normalizedOptions;
    }
    if (!taskTypeOptions.value.some((option) => option.value === newTaskType.value)) {
      newTaskType.value = taskTypeOptions.value[0]?.value || 'feature';
    }
  } catch {
    // Keep local defaults if dictionary endpoint is unavailable.
  } finally {
    taskTypeLoading.value = false;
  }
};

const loadUsers = async (search = '') => {
  const appendSelectedUsers = (items) => {
    const map = new Map(items.map((item) => [String(item.value), item]));
    for (const userId of assigneeUserIds.value) {
      const key = String(userId);
      if (map.has(key)) continue;
      const user = tasksStore.store.user[key];
      if (!user) continue;
      map.set(key, {
        title: user.fullName ? `${user.fullName} (${user.login})` : user.login,
        value: key,
      });
    }
    return Array.from(map.values());
  };

  if (!search) {
    const currentUser = tasksStore.store.user[currentUserId.value];
    const items = currentUser
      ? [
          {
            title: currentUser.fullName ? `${currentUser.fullName} (${currentUser.login})` : currentUser.login,
            value: currentUserId.value,
          },
        ]
      : [];
    assigneeOptions.value = appendSelectedUsers(items);
    if (assigneeUserIds.value.length === 0 && currentUserId.value) {
      assigneeUserIds.value = [currentUserId.value];
    }
    return;
  }
  const usersMethod = getUsersMethod();
  if (!usersMethod) return;
  assigneeLoading.value = true;
  try {
    const response = await usersMethod({ search, limit: 20 });
    const users = Array.isArray(response?.users) ? response.users : [];
    const items = users.map((user) => ({
      title: user.fullName ? `${user.fullName} (${user.login})` : user.login,
      value: String(user.userId),
    }));
    assigneeOptions.value = appendSelectedUsers(items);
    for (const user of users) {
      tasksStore.store.user[String(user.userId)] = user;
    }
    if (assigneeUserIds.value.length === 0 && currentUserId.value) {
      assigneeUserIds.value = [currentUserId.value];
    }
  } catch {
    // Keep previous options on transient request errors.
  } finally {
    assigneeLoading.value = false;
  }
};

const tryRestoreSession = async () => {
  const token = localStorage.getItem('metarhia.session.token');
  if (!token || !api?.auth?.restore) return false;
  try {
    const response = await api.auth.restore({ token });
    if (response.status === 'logged') {
      const user = response?.user;
      if (user?.userId) {
        const userId = String(user.userId);
        tasksStore.store.user[userId] = {
          userId,
          login: user.login || '',
          fullName: user.fullName || '',
        };
        tasksStore.store.currentUserId = userId;
      }
      return true;
    }
  } catch {
    // Invalid token, signin required.
  }
  localStorage.removeItem('metarhia.session.token');
  return false;
};

const waitForAuth = () =>
  new Promise((resolve) => {
    authResolve = resolve;
    authDialog.value = true;
  });

const submitAuth = async () => {
  if (!api?.auth?.signin) {
    authError.value = 'API auth.signin недоступен';
    return;
  }
  if (!authLogin.value.trim() || !authPassword.value) {
    authError.value = 'Укажи логин и пароль';
    return;
  }
  authLoading.value = true;
  authError.value = '';
  try {
    const response = await api.auth.signin({
      login: authLogin.value.trim(),
      password: authPassword.value,
    });
    if (response?.token) {
      const user = response?.user;
      if (user?.userId) {
        const userId = String(user.userId);
        tasksStore.store.user[userId] = {
          userId,
          login: user.login || '',
          fullName: user.fullName || '',
        };
        tasksStore.store.currentUserId = userId;
      }
      localStorage.setItem('metarhia.session.token', response.token);
      authDialog.value = false;
      authPassword.value = '';
      if (authResolve) authResolve(true);
      authResolve = null;
      return;
    }
    authError.value = 'Не удалось выполнить вход';
  } catch (error) {
    authError.value = error.message || 'Ошибка авторизации';
  } finally {
    authLoading.value = false;
  }
};

const submitRegister = async () => {
  if (!api?.auth?.register) {
    authError.value = 'API auth.register недоступен';
    return;
  }
  if (!authLogin.value.trim() || !authPassword.value) {
    authError.value = 'Укажи логин и пароль';
    return;
  }
  authLoading.value = true;
  authError.value = '';
  try {
    const response = await api.auth.register({
      login: authLogin.value.trim(),
      password: authPassword.value,
      fullName: authFullName.value.join(', ').trim() || authLogin.value.trim(),
    });
    if (response?.token) {
      const user = response?.user;
      if (user?.userId) {
        const userId = String(user.userId);
        tasksStore.store.user[userId] = {
          userId,
          login: user.login || '',
          fullName: user.fullName || '',
        };
        tasksStore.store.currentUserId = userId;
      }
      localStorage.setItem('metarhia.session.token', response.token);
      authDialog.value = false;
      authPassword.value = '';
      authFullName.value = [];
      if (authResolve) authResolve(true);
      authResolve = null;
      return;
    }
    authError.value = 'Не удалось выполнить регистрацию';
  } catch (error) {
    authError.value = error.message || 'Ошибка регистрации';
  } finally {
    authLoading.value = false;
  }
};

onMounted(async () => {
  try {
    const backend = await initBackend();
    api = backend.api;
    const restored = await tryRestoreSession();
    if (!restored) {
      status.value = 'Требуется авторизация';
      await waitForAuth();
    }
    await loadUsers();
    await subscribeStoreUpdates();
    const tasksList = getTasksListMethod();
    if (!tasksList) throw new Error('API tasksList недоступен');
    const response = await tasksList();
    tasksStore.setTasksData({
      tasks: response.tasks || [],
      users: response.users || [],
      currentUserId: response.currentUserId || '',
    });
    await loadTaskTypes();
    await loadUsers();
    status.value = 'Подключено';
  } catch (error) {
    status.value = 'Недоступен';
    errorText.value = `Не удалось подключиться к backend: ${error.message}`;
  }
});

watch(dialog, async (opened) => {
  if (!opened) return;
  await loadTaskTypes();
  await loadUsers(assigneeSearch.value);
  if (currentUserId.value) {
    assigneeUserIds.value = [currentUserId.value];
  }
});

watch(assigneeSearch, async (value) => {
  if (!dialog.value) return;
  const search = (value || '').trim();
  if (search.length === 0) {
    await loadUsers('');
    return;
  }
  if (search.length < 3) return;
  await loadUsers(search);
});

watch(assigneeUserIds, () => {
  assigneeSearch.value = '';
});

watch(detailDrawer, async (opened) => {
  if (!opened) return;
  await loadTaskTypes();
  await loadEditUsers(editAssigneeSearch.value);
});

watch(editAssigneeSearch, async (value) => {
  if (!detailDrawer.value) return;
  const search = (value || '').trim();
  if (search.length === 0) {
    await loadEditUsers('');
    return;
  }
  if (search.length < 3) return;
  await loadEditUsers(search);
});

watch(editAssigneeUserIds, () => {
  editAssigneeSearch.value = '';
});
</script>

<style scoped>
.app-main {
  min-width: 0;
}

/* Панель задачи: фиксированная ширина; переопределяем max-width: 100% у Vuetify, иначе панель сжимается вместе с экраном */
.task-detail-drawer {
  width: 440px !important;
  min-width: 440px !important;
  max-width: 440px !important;
  flex-shrink: 0 !important;
  box-sizing: border-box;
}

.app-content {
  max-width: 100%;
}

@media (min-width: 1280px) {
  .app-content {
    max-width: 1200px;
  }
}

.column-card {
  min-height: 420px;
}

.column-body {
  min-height: 340px;
}

.task-card-main {
  cursor: pointer;
}

.task-detail-drawer :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.task-detail-inner {
  flex: 1;
  overflow: auto;
}

.task-detail-header-text {
  min-width: 0;
}

.task-detail-title-clickable {
  cursor: pointer;
  margin: 0;
  align-self: stretch;
  border-radius: 4px;
  padding: 2px 4px;
  margin-left: -4px;
  outline: none;
}

.task-detail-title-clickable:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}

.task-detail-title-field {
  margin-bottom: 0 !important;
  padding-top: 0;
}

.task-detail-window {
  min-height: 200px;
}

.task-detail-window :deep(.v-window__container) {
  padding-top: 20px;
  padding-bottom: 0;
}
</style>
