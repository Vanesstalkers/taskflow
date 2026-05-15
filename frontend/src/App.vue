<template>
  <v-app class="app-root">
    <v-main class="app-main" scrollable>
      <v-container class="app-content py-8">
        <div class="d-flex align-center justify-space-between mb-4">
          <div>
            <h1 class="text-h4 mb-1">{{ currentUserDisplay }}</h1>
            <p class="text-body-2 text-medium-emphasis">Статус backend: {{ status }}</p>
            <v-switch
              v-model="devMode"
              class="dev-mode-switch mt-2"
              color="warning"
              density="compact"
              hide-details
              label="Dev-режим"
            />
          </div>
          <div class="d-flex ga-2 flex-shrink-0">
            <v-badge
              v-if="devMode"
              :content="remarksBadgeCount"
              :model-value="remarksBadgeCount > 0"
              color="warning"
            >
              <v-btn variant="tonal" prepend-icon="mdi-comment-text-multiple-outline" @click="openRemarksPanel">
                Правки
              </v-btn>
            </v-badge>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="createTaskDialogOpen = true"> Новая задача </v-btn>
          </div>
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

      <CreateTaskDialog v-model="createTaskDialogOpen" />

      <AuthDialog ref="authDialogRef" />

      <RemarkDialog v-model="remarkDialogOpen" :payload="remarkPayload" @saved="onRemarkSaved" />

      <RemarksPanel ref="remarksPanelRef" v-model="remarksPanelOpen" @changed="refreshRemarksBadge" />
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
        @close="closeTaskDetail"
        @move="(step) => moveTask(selectedTask._id, step)"
      />
    </v-navigation-drawer>
  </v-app>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { initBackend } from './main.js';
import { subscribeStoreUpdates } from './utils/storeActions.js';
import AuthDialog from './components/AuthDialog.vue';
import CreateTaskDialog from './components/CreateTaskDialog.vue';
import TaskForm from './components/TaskForm.vue';
import RemarkDialog from './components/RemarkDialog.vue';
import RemarksPanel from './components/RemarksPanel.vue';
import { getRemarks } from './utils/remarkActions.js';
import { normalizeRemarkStatus } from './utils/remarkStatus.js';
import { useDevRemarkCapture } from './composables/useDevRemarkCapture.js';
import { useDevMode } from './composables/useDevMode.js';
import { useStore } from './stores/store.js';

const globalStore = useStore();
const { devMode } = useDevMode();

const status = ref('Инициализация...');
const errorText = ref('');
const createTaskDialogOpen = ref(false);
const remarksPanelOpen = ref(false);
const remarksPanelRef = ref(null);
const remarksBadgeCount = ref(0);
/** Справочник с бэка: `{ code, title }` → подписи типов на доске и в TaskForm */
const taskTypeOptions = computed(() => {
  const raw = globalStore.lst.taskTypes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      title: String(item?.title || '').trim(),
      code: String(item?.code ?? item?.value ?? item?.id ?? '').trim(),
    }))
    .filter((o) => o.title && o.code);
});
const detailDrawer = ref(false);
const selectedTaskId = ref('');
const movingTaskId = ref('');

const { remarkDialogOpen, remarkPayload } = useDevRemarkCapture({
  scopeHint: () => {
    const task = globalStore.store.task?.[selectedTaskId.value];
    return task?.taskType ? String(task.taskType) : '';
  },
  getContext: () => {
    const taskId = selectedTaskId.value;
    if (!taskId) return {};
    const task = globalStore.store.task?.[taskId];
    return {
      taskId,
      taskType: task?.taskType ? String(task.taskType) : '',
    };
  },
});
const authDialogRef = ref(null);
let api = null;

function openRemarksPanel() {
  remarksPanelOpen.value = true;
}

async function refreshRemarksBadge() {
  try {
    const res = await getRemarks({ limit: 200 });
    const list = res.remarks || [];
    remarksBadgeCount.value = list.filter((r) => {
      const s = normalizeRemarkStatus(r.status);
      return s === 'new' || s === 'review';
    }).length;
  } catch {
    remarksBadgeCount.value = 0;
  }
}

function onRemarkSaved() {
  void refreshRemarksBadge();
  remarksPanelRef.value?.loadRemarks?.();
}

watch(devMode, (active) => {
  if (!active) {
    remarksPanelOpen.value = false;
    remarkDialogOpen.value = false;
  }
});

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
const getUserTaskListMethod = () => api?.core?.getUserTaskList;
const getTaskMethod = () => api?.core?.getTask;
const selectedTask = computed(() => {
  const id = selectedTaskId.value;
  if (!id) return null;
  return globalStore.store.task[id] || null;
});

const taskTypeLabelByValue = computed(() => {
  const m = new Map();
  for (const option of taskTypeOptions.value) {
    if (option.code) m.set(option.code, option.title);
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

const openTaskDetail = async (task) => {
  const rawId = task?._id;
  const id = rawId != null && rawId !== '' ? String(rawId).trim() : '';
  if (!id || id === 'undefined') return;
  selectedTaskId.value = id;
  detailDrawer.value = true;

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

    globalStore.setData({ lst: res.lst || {}, store: patch });

    if (!globalStore.store.task[id]) return;
  } catch (error) {
    errorText.value = error.message || 'Не удалось загрузить задачу';
  }
};

const tryRestoreSession = async () => {
  const token = localStorage.getItem('metarhia.session.token');
  if (!token || !api?.auth?.restore) return false;
  try {
    const response = await api.auth.restore({ token });
    if (response?.status === 'logged') {
      const { userId: _id, login } = response.user || {};

      globalStore.currentUserId = _id;
      globalStore.store.user[_id] = { _id, login };

      return true;
    }
  } catch {}
  localStorage.removeItem('metarhia.session.token');
  return false;
};

onMounted(async () => {
  try {
    const backend = await initBackend();
    api = backend.api;
    const restored = await tryRestoreSession();
    if (!restored) {
      status.value = 'Требуется авторизация';
      await authDialogRef.value?.openAndWait();
    }
    await subscribeStoreUpdates();
    const tasksList = getUserTaskListMethod();
    if (!tasksList) throw new Error('API tasksList недоступен');
    const response = await tasksList();
    
    globalStore.setData({
      lst: response.lst,
      store: {
        task: response.tasks || [],
        user: response.users || [],
      },
    });

    status.value = 'Подключено';
    await refreshRemarksBadge();
  } catch (error) {
    status.value = 'Недоступен';
    errorText.value = `Не удалось подключиться к backend: ${error.message}`;
  }
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
</style>
