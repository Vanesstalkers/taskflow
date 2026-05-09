<template>
  <v-app>
    <v-main>
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
                <v-card v-for="task in tasksByStatus[column.id]" :key="task.id" class="mb-3" variant="elevated">
                  <v-card-item>
                    <v-card-title class="text-subtitle-1">{{ task.title }}</v-card-title>
                    <v-card-subtitle>{{ task.description || 'Без описания' }}</v-card-subtitle>
                  </v-card-item>
                  <v-card-actions>
                    <v-btn
                      size="small"
                      variant="text"
                      :disabled="!canMoveLeft(task.status) || movingTaskId === String(task.id)"
                      @click="moveTask(task.id, -1)"
                    >
                      Назад
                    </v-btn>
                    <v-spacer />
                    <v-btn
                      size="small"
                      color="primary"
                      variant="text"
                      :disabled="!canMoveRight(task.status) || movingTaskId === String(task.id)"
                      @click="moveTask(task.id, 1)"
                    >
                      Вперёд
                    </v-btn>
                  </v-card-actions>
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
  </v-app>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { initBackend } from './api/backend.js';
import { subscribeStoreUpdates } from './api/storeUpdates.js';
import { useTasksStore } from './stores/tasks.js';

const status = ref('Инициализация...');
const errorText = ref('');
const dialog = ref(false);
const newTitle = ref('');
const newDescription = ref('');
const assigneeUserIds = ref([]);
const assigneeOptions = ref([]);
const assigneeSearch = ref('');
const assigneeLoading = ref(false);
const creatingTask = ref(false);
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
  assigneeSearch.value = '';
  if (currentUserId.value) {
    assigneeUserIds.value = [currentUserId.value];
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
    await loadUsers();
    status.value = 'Подключено';
  } catch (error) {
    status.value = 'Недоступен';
    errorText.value = `Не удалось подключиться к backend: ${error.message}`;
  }
});

watch(dialog, async (opened) => {
  if (!opened) return;
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
</script>

<style scoped>
.app-content {
  max-width: 1200px;
}

.column-card {
  min-height: 420px;
}

.column-body {
  min-height: 340px;
}
</style>
