<template>
  <v-app class="app-root">
    <AppNavbar
      v-model:dev-mode="devMode"
      :current-user-display="currentUserDisplay"
      :current-user-id="currentUserId"
      :status="`Статус backend: ${status}`"
      :searchable-collections="searchableCollections"
      :collections-loading="collectionsLoading"
      :remarks-badge-count="remarksBadgeCount"
      @open-remarks="openRemarksPanel"
      @create-task="createTaskDialogOpen = true"
      @pick-task="onNavbarPickTask"
      @pick-entity="onNavbarPickEntity"
      @open-collection-list="onOpenCollectionList"
      @open-current-user="openCurrentUser"
      @logout="onLogout"
    />

    <AppFavouritesSidebar
      v-model:rail="sidebarRail"
      :favourites="favourites"
      :can-add-from-tab="canAddFavouriteFromTab"
      @open="openFavourite"
      @edit="openFavouriteEdit"
      @add-from-tab="addFavouriteFromActiveTab"
    />

    <v-main class="app-main" scrollable>
      <v-container class="app-content py-4">
        <v-alert v-if="errorText" type="error" variant="tonal" class="mb-4">
          {{ errorText }}
        </v-alert>

        <AppMainTabs
          v-model:active-tab-id="activeTabId"
          :tabs="tabs"
          @close-tab="closeTab"
          @favourite-added="onFavouriteAdded"
          @open-entity="onListOpenEntity"
        >
          <template #board>
            <KanbanBoard
              :task-type-label-by-value="taskTypeLabelByValue"
              @open-task="openTaskDetail"
              @add-task-favourite="addTaskToFavourites"
            />
          </template>
        </AppMainTabs>
      </v-container>

      <CreateTaskDialog v-model="createTaskDialogOpen" />

      <AuthDialog ref="authDialogRef" />

      <RemarkDialog v-model="remarkDialogOpen" :payload="remarkPayload" @saved="onRemarkSaved" />

      <RemarksPanel ref="remarksPanelRef" v-model="remarksPanelOpen" @changed="refreshRemarksBadge" />

      <FavouriteEditDialog
        v-model="favouriteEditOpen"
        :favourite="favouriteEditTarget"
        @saved="onFavouriteSaved"
        @removed="onFavouriteRemoved"
      />
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
        @add-favourite="addTaskToFavourites({ taskId: selectedTaskId, title: selectedTask?.title })"
      />
    </v-navigation-drawer>
  </v-app>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { initBackend } from './main.js';
import { subscribeStoreUpdates } from './utils/storeActions.js';
import AppNavbar from './components/AppNavbar.vue';
import AppFavouritesSidebar from './components/AppFavouritesSidebar.vue';
import AppMainTabs from './components/AppMainTabs.vue';
import KanbanBoard from './components/KanbanBoard.vue';
import FavouriteEditDialog from './components/FavouriteEditDialog.vue';
import { useAppTabs } from './composables/useAppTabs.js';
import { saveUserTabs } from './utils/userTabsActions.js';
import { addFavourite } from './utils/favouriteActions.js';
import { loadView as fetchLoadView } from './utils/loadViewActions.js';
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
import { formatUserLabel } from './utils/userLabel.js';

const globalStore = useStore();
const { devMode } = useDevMode();
const {
  tabs,
  activeTabId,
  openSearchResultTab,
  openCollectionListTab,
  closeTab,
  restoreWorkspace,
  serializeWorkspace,
} = useAppTabs();

let tabsPersistenceReady = false;
let saveTabsTimer = null;

function scheduleSaveUserTabs() {
  if (!tabsPersistenceReady || !api?.core?.saveUserTabs) return;
  if (saveTabsTimer) clearTimeout(saveTabsTimer);
  saveTabsTimer = setTimeout(() => {
    void saveUserTabs(serializeWorkspace()).catch(() => {});
  }, 500);
}

function applyLoadView(view) {
  if (!view || typeof view !== 'object') return;

  restoreWorkspace({
    activeTabId: view.activeTabId,
    tabs: view.tabs,
  });

  remarksBadgeCount.value = Number(view.remarksBadgeCount) || 0;
  searchableCollections.value = Array.isArray(view.collections) ? view.collections : [];

  const list = Array.isArray(view.favourites) ? view.favourites : [];
  favourites.value = list;
  if (list.length > 0) {
    globalStore.setData({
      store: { favourite: Object.fromEntries(list.map((f) => [f._id, f])) },
    });
  }
}

async function loadView() {
  if (!api?.core?.loadView) {
    restoreWorkspace();
    remarksBadgeCount.value = 0;
    searchableCollections.value = [];
    favourites.value = [];
    tabsPersistenceReady = true;
    return;
  }

  collectionsLoading.value = true;
  try {
    const view = await fetchLoadView();
    applyLoadView(view);
  } catch {
    restoreWorkspace();
    remarksBadgeCount.value = 0;
    searchableCollections.value = [];
    favourites.value = [];
  } finally {
    collectionsLoading.value = false;
    tabsPersistenceReady = true;
  }
}

watch([tabs, activeTabId], scheduleSaveUserTabs, { deep: true });

const status = ref('Инициализация...');
const errorText = ref('');
const createTaskDialogOpen = ref(false);
const remarksPanelOpen = ref(false);
const remarksPanelRef = ref(null);
const remarksBadgeCount = ref(0);
const searchableCollections = ref([]);
const collectionsLoading = ref(false);
const sidebarRail = ref(false);
const favourites = ref([]);
const favouriteEditOpen = ref(false);
const favouriteEditTarget = ref(null);

const canAddFavouriteFromTab = computed(() => {
  const tab = tabs.value.find((t) => t.id === activeTabId.value);
  return Boolean(tab?.closable);
});
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

const getColumnIndex = (statusId) => columns.findIndex((column) => column.id === statusId);

const canMoveLeft = (statusId) => getColumnIndex(statusId) > 0;
const canMoveRight = (statusId) => getColumnIndex(statusId) < columns.length - 1;
const currentUserId = computed(() => String(globalStore.currentUserId || ''));
const currentUserDisplay = computed(() => {
  const user = globalStore.store.user?.[currentUserId.value];
  return formatUserLabel(user, globalStore.store);
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

function patchSearchEntityToStore({ collection, code, title }) {
  if (!collection || !code) return;
  if (!globalStore.store[collection]) globalStore.store[collection] = {};
  const prev = globalStore.store[collection][code] || {};
  globalStore.store[collection][code] = {
    ...prev,
    _id: code,
    ...(title ? { title } : {}),
  };
}

function onNavbarPickTask({ code, title, groupTitle }) {
  const id = String(code || '').trim();
  if (!id) return;
  patchSearchEntityToStore({ collection: 'task', code: id, title });
  openSearchResultTab({ kind: 'task', code: id, title, groupTitle });
}

function onNavbarPickEntity({ collection, code, title, groupTitle }) {
  if (!collection || !code) return;
  patchSearchEntityToStore({ collection, code, title });
  openSearchResultTab({ kind: 'entity', collection, code, title, groupTitle });
}

function onOpenCollectionList({ collection, title }) {
  if (!collection) return;
  openCollectionListTab({ collection, title });
}

function onListOpenEntity(payload) {
  onNavbarPickEntity(payload);
}

function openCurrentUser() {
  const id = currentUserId.value;
  if (!id) return;
  onNavbarPickEntity({
    collection: 'user',
    code: id,
    title: currentUserDisplay.value || id,
    groupTitle: 'Пользователи',
  });
}

function upsertFavourite(fav) {
  if (!fav?._id) return;
  const index = favourites.value.findIndex((f) => f._id === fav._id);
  if (index >= 0) favourites.value[index] = { ...favourites.value[index], ...fav };
  else favourites.value.push(fav);
}

function openFavourite(fav) {
  if (!fav?.targetCollection) return;

  if (fav.targetKind === 'registry') {
    openCollectionListTab({ collection: fav.targetCollection, title: fav.title });
    return;
  }

  if (!fav?.targetId) return;

  if (fav.targetKind === 'task') {
    const id = String(fav.targetId).trim();
    patchSearchEntityToStore({ collection: 'task', code: id, title: fav.title });
    void openTaskDetail({ _id: id, title: fav.title });
    return;
  }

  patchSearchEntityToStore({
    collection: fav.targetCollection,
    code: fav.targetId,
    title: fav.title,
  });
  openSearchResultTab({
    kind: 'entity',
    collection: fav.targetCollection,
    code: fav.targetId,
    title: fav.title,
    groupTitle: fav.title,
  });
}

function openFavouriteEdit(fav) {
  favouriteEditTarget.value = fav;
  favouriteEditOpen.value = true;
}

function onFavouriteSaved(updated) {
  upsertFavourite(updated);
}

function onFavouriteRemoved(id) {
  favourites.value = favourites.value.filter((f) => f._id !== id);
}

function onFavouriteAdded(fav) {
  upsertFavourite(fav);
}

async function addTaskToFavourites({ taskId, title }) {
  const id = String(taskId || '').trim();
  if (!id) return;
  try {
    const res = await addFavourite({
      title: String(title || '').trim() || id,
      icon: 'mdi-clipboard-text-outline',
      targetKind: 'task',
      targetCollection: 'task',
      targetId: id,
    });
    upsertFavourite(res.favourite);
  } catch (error) {
    errorText.value = error.message || 'Не удалось добавить в избранное';
  }
}

async function addFavouriteFromActiveTab() {
  const tab = tabs.value.find((t) => t.id === activeTabId.value);
  if (!tab?.closable) return;
  try {
    if (tab.type === 'collection-list') {
      const res = await addFavourite({
        title: tab.title,
        icon: 'mdi-database-search-outline',
        targetKind: 'registry',
        targetCollection: tab.collection,
      });
      upsertFavourite(res.favourite);
      return;
    }
    const targetKind = tab.type === 'task' ? 'task' : 'entity';
    const res = await addFavourite({
      title: tab.title,
      icon: targetKind === 'task' ? 'mdi-clipboard-text-outline' : 'mdi-bookmark-outline',
      targetKind,
      targetCollection: tab.collection,
      targetId: tab.code,
    });
    upsertFavourite(res.favourite);
  } catch (error) {
    errorText.value = error.message || 'Не удалось добавить в избранное';
  }
}

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

async function reloadSessionData() {
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
  await loadView();
}

const onLogout = async () => {
  const token = localStorage.getItem('metarhia.session.token');
  try {
    const signout = api?.auth?.signout;
    if (token && typeof signout === 'function') {
      await signout({ token });
    }
  } catch (error) {
    errorText.value = error.message || 'Не удалось выполнить выход';
  } finally {
    localStorage.removeItem('metarhia.session.token');
    location.reload();
  }
};

const tryRestoreSession = async () => {
  const token = localStorage.getItem('metarhia.session.token');
  if (!token || !api?.auth?.restore) return false;
  try {
    const response = await api.auth.restore({ token });
    if (response?.status === 'logged') {
      const { _id, login, pp } = response.user || {};
      const ppLink =
        pp && typeof pp === 'object'
          ? Object.fromEntries(Object.keys(pp).map((ppId) => [ppId, {}]))
          : {};

      globalStore.currentUserId = _id;
      if (!globalStore.store.user) globalStore.store.user = {};
      globalStore.store.user[_id] = { ...(globalStore.store.user[_id] || {}), _id, login, pp: ppLink };

      const ppStore = response.store?.pp;
      if (ppStore && typeof ppStore === 'object') {
        globalStore.store.pp = { ...(globalStore.store.pp || {}), ...ppStore };
      }

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
    await reloadSessionData();
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
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-height: calc(100vh - 64px);
}

@media (min-width: 1280px) {
  .app-content {
    max-width: 1200px;
  }
}

.task-detail-drawer :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
