<template>
  <v-app class="app-root">
    <v-main class="app-main" scrollable>
      <v-container class="app-content py-8">
        <div class="d-flex align-center justify-space-between mb-4">
          <div>
            <h1 class="text-h4 mb-1">{{ currentUserDisplay }}</h1>
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
                <v-card
                  v-for="task in tasksByStatus[column.id]"
                  :key="task._id"
                  class="mb-3 task-card"
                  variant="elevated"
                >
                  <v-card-item class="task-card-main" @click="openTaskDetail(task)">
                    <v-card-title class="text-subtitle-1">{{ task.title }}</v-card-title>
                    <v-card-subtitle>{{ task.description || 'Без описания' }}</v-card-subtitle>
                    <div class="mt-2" @click.stop>
                      <v-chip size="x-small" variant="tonal">
                        {{ taskTypeLabelByValue.get(String(task.taskType || '')) || task.taskType }}
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
            <ComplexBlock
              v-model="assigneeUserIds"
              remote-search
              collection="user"
              picker-label="Исполнитель"
              class="mt-3"
              :disabled="creatingTask"
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
          </v-card-text>
          <v-alert v-if="authError" type="error" variant="tonal" class="mb-3">
            {{ authError }}
          </v-alert>
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
      <TaskForm
        v-if="selectedTask"
        :task="selectedTask"
        :task-id="selectedTaskId"
        :task-type-label="taskTypeLabelByValue.get(String(selectedTask.taskType || ''))"
        :column-title="columnTitleByStatusId[selectedTask.status] || ''"
        :can-move-left="canMoveLeft(selectedTask.status)"
        :can-move-right="canMoveRight(selectedTask.status)"
        :moving-task-id="movingTaskId"
        v-model:description="editDescription"
        v-model:assignee-user-ids="editAssigneeUserIds"
        v-model:doc-ids="editDocIds"
        @close="closeTaskDetail"
        @move="(step) => moveTask(selectedTask._id, step)"
      />
    </v-navigation-drawer>
  </v-app>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { initBackend } from './api/backend.js';
import { subscribeStoreUpdates } from './utils/storeActions.js';
import ComplexBlock from './components/ComplexBlock.vue';
import TaskForm from './components/TaskForm.vue';
import { useStore } from './stores/store.js';

const globalStore = useStore();

const status = ref('Инициализация...');
const errorText = ref('');
const dialog = ref(false);
const newTitle = ref('');
const newDescription = ref('');
const newTaskType = ref('');
/** Справочник с бэка: `{ id, title }` или `{ value, title }` → единый вид для v-select и подписей */
const taskTypeOptions = computed(() => {
  const raw = globalStore.lst.taskTypes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      title: String(item?.title || '').trim(),
      value: String(item?.value ?? item?.id ?? '').trim(),
    }))
    .filter((o) => o.title && o.value);
});
const taskTypeLoading = computed(() => Boolean(globalStore.lstLoading.taskTypes));
const assigneeUserIds = ref([]);
const creatingTask = ref(false);
const detailDrawer = ref(false);
const selectedTaskId = ref('');
const editDescription = ref('');
const editAssigneeUserIds = ref([]);
const editDocIds = ref([]);
const movingTaskId = ref('');
const authDialog = ref(false);
const authLoading = ref(false);
const authLogin = ref('');
const authPassword = ref('');
const authError = ref('');
let api = null;
let authResolve = null;

const columns = [
  { id: 'todo', title: 'To Do' },
  { id: 'inProgress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

const columnTitleByStatusId = Object.fromEntries(columns.map((column) => [column.id, column.title]));

const taskList = computed(() => Object.values(globalStore.store.task));

const tasksByStatus = computed(() => ({
  todo: taskList.value.filter((task) => task.status === 'todo'),
  inProgress: taskList.value.filter((task) => task.status === 'inProgress'),
  done: taskList.value.filter((task) => task.status === 'done'),
}));

const getColumnIndex = (statusId) => columns.findIndex((column) => column.id === statusId);

const canMoveLeft = (statusId) => getColumnIndex(statusId) > 0;
const canMoveRight = (statusId) => getColumnIndex(statusId) < columns.length - 1;
const currentUserId = computed(() => String(globalStore.currentUserId || ''));
const currentUserDisplay = computed(() => {
  const user = globalStore.store.user?.[currentUserId.value];
  if (!user) return '';
  const login = String(user.login || '').trim();
  return login;
});
const getTaskMoveMethod = () => api?.core?.taskMove;
const getTasksListMethod = () => api?.core?.tasksList;
const getTaskMethod = () => api?.core?.getTask;
const getTaskCreateMethod = () => api?.core?.addObject;
const getLstMethod = () => api?.core?.getLst;
const selectedTask = computed(() => {
  const id = selectedTaskId.value;
  if (!id) return null;
  return globalStore.store.task[id] || null;
});

const taskTypeLabelByValue = computed(() => {
  const m = new Map();
  for (const option of taskTypeOptions.value) {
    if (option.value) m.set(option.value, option.title);
  }
  return m;
});

const moveTask = async (id, step) => {
  const taskMove = getTaskMoveMethod();
  if (!taskMove) {
    errorText.value = 'API taskMove недоступен';
    return;
  }
  const task = globalStore.store.task[id];
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
  newTaskType.value = '';
  if (currentUserId.value) {
    assigneeUserIds.value = [currentUserId.value];
  }
};

const openTaskDetail = async (task) => {
  const rawId = task?._id;
  const id = rawId != null && rawId !== '' ? String(rawId).trim() : '';
  if (!id || id === 'undefined') return;
  selectedTaskId.value = id;
  editDescription.value = task.description || '';
  editDocIds.value = Object.keys(task.docLinks || {}).filter(Boolean);
  const linkIds = Object.keys(task.userLinks || {}).filter(Boolean);
  editAssigneeUserIds.value = linkIds.length > 0 ? linkIds : currentUserId.value ? [currentUserId.value] : [];
  detailDrawer.value = true;
  // await loadLst();
  await loadTask(id);
};

const closeTaskDetail = () => {
  detailDrawer.value = false;
  selectedTaskId.value = '';
};

/** Снимок задачи + user/pp для панели формы (сервер, с проверкой доступа по userLinks). */
const loadTask = async (_id) => {
  const method = getTaskMethod();
  const id = typeof _id === 'string' ? _id.trim() : String(_id ?? '').trim();
  if (!method || !id || id === 'undefined') return;
  errorText.value = '';
  try {
    const res = await method({ _id: id });
    if (res?.error) {
      if (res.error === 'not_found') {
        errorText.value = 'Задача не найдена или нет доступа';
        closeTaskDetail();
      } else if (res.error === 'unauthorized') {
        errorText.value = 'Требуется авторизация';
      }
      return;
    }
    const patch = res?.store;
    if (!patch || typeof patch !== 'object') return;
    globalStore.setData({
      currentUserId: globalStore.currentUserId,
      lst: res?.lst || {},
      store: patch,
    });
    const task = globalStore.store.task[id];
    if (!task) return;
    editDescription.value = task.description || '';
    editDocIds.value = Object.keys(task.docLinks || {}).filter(Boolean);
    const linkIds = Object.keys(task.userLinks || {}).filter(Boolean);
    editAssigneeUserIds.value = linkIds.length > 0 ? linkIds : currentUserId.value ? [currentUserId.value] : [];
  } catch (error) {
    errorText.value = error.message || 'Не удалось загрузить задачу';
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
    errorText.value = 'API addObject недоступен';
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
        taskType: newTaskType.value,
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

const loadLst = async () => {
  const lstMethod = getLstMethod();
  if (!lstMethod) return;
  await Promise.all([
    globalStore.fetchLst({ name: 'taskTypes', getLst: lstMethod }),
    globalStore.fetchLst({ name: 'userRoles', getLst: lstMethod }),
  ]);
  if (taskTypeOptions.value.length > 0 && !taskTypeOptions.value.some((option) => option.value === newTaskType.value)) {
    newTaskType.value = taskTypeOptions.value[0]?.value || '';
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
        globalStore.store.user[userId] = {
          userId,
          login: user.login || '',
        };
        globalStore.currentUserId = userId;
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
        globalStore.store.user[userId] = { userId, login: user.login || '' };
        globalStore.currentUserId = userId;
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
    });
    if (response?.token) {
      const user = response?.user;
      if (user?.userId) {
        const userId = String(user.userId);
        globalStore.store.user[userId] = { userId, login: user.login || '' };
        globalStore.currentUserId = userId;
      }
      localStorage.setItem('metarhia.session.token', response.token);
      authDialog.value = false;
      authPassword.value = '';
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
    await subscribeStoreUpdates();
    const tasksList = getTasksListMethod();
    if (!tasksList) throw new Error('API tasksList недоступен');
    const response = await tasksList();
    globalStore.setData({
      currentUserId: response.currentUserId || '',
      lst: response.lst,
      store: {
        task: response.tasks || [],
        user: response.users || [],
      },
    });
    // await loadLst();
    status.value = 'Подключено';
  } catch (error) {
    status.value = 'Недоступен';
    errorText.value = `Не удалось подключиться к backend: ${error.message}`;
  }
});

watch(dialog, async (opened) => {
  if (!opened) return;
  if (
    taskTypeOptions.value.length > 0 &&
    (!newTaskType.value || !taskTypeOptions.value.some((o) => o.value === newTaskType.value))
  ) {
    newTaskType.value = taskTypeOptions.value[0].value;
  }
  if (currentUserId.value) {
    assigneeUserIds.value = [currentUserId.value];
  }
});

watch(
  () => selectedTask.value?.docLinks,
  (docLinks) => {
    if (!detailDrawer.value || !selectedTaskId.value) return;
    const next = Object.keys(docLinks || {}).filter(Boolean);
    const prev = editDocIds.value;
    if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) return;
    editDocIds.value = next;
  },
  { deep: true },
);
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
</style>
