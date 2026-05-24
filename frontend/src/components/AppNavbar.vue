<template>
  <v-app-bar elevation="1" density="comfortable" class="app-navbar border-b">
    <div ref="searchWrapRef" class="app-navbar__search-wrap">
      <v-text-field
        v-model="query"
        class="app-navbar__search"
        density="compact"
        variant="solo-filled"
        flat
        rounded
        hide-details
        clearable
        placeholder="Поиск по задачам и справочникам…"
        prepend-inner-icon="mdi-magnify"
        autocomplete="off"
        @update:model-value="onQueryInput"
        @focus="searchFocused = true"
        @blur="onSearchBlur"
        @keydown.enter.prevent="pickFirst()"
        @keydown.escape="closeMenu()"
      />
    </div>

    <v-menu
      v-model="menuOpen"
      :activator="searchWrapRef"
      location="bottom"
      max-height="360"
      :close-on-content-click="true"
      @update:model-value="(v) => { if (!v) searchFocused = false; }"
    >
      <v-list v-if="menuOpen" density="compact" class="app-navbar__results">
        <template v-if="searchLoading">
          <v-list-item title="Поиск…" disabled />
        </template>
        <template v-else-if="query.trim().length < 3">
          <v-list-item title="Введите не менее 3 символов" disabled />
        </template>
        <template v-else-if="groups.length === 0">
          <v-list-item title="Ничего не найдено" disabled />
        </template>
        <template v-else>
          <template v-for="(group, gi) in groups" :key="`${group.kind}-${group.collection}-${gi}`">
            <v-list-subheader>{{ groupLabel(group) }}</v-list-subheader>
            <v-list-item
              v-for="item in group.items"
              :key="`${group.collection}:${item.code}`"
              :title="item.title"
              @click="pickItem(group, item)"
            />
          </template>
        </template>
      </v-list>
    </v-menu>

    <v-select
      v-model="selectedCollection"
      class="app-navbar__collections ms-2"
      :items="searchableCollections"
      item-title="title"
      item-value="collection"
      label="Реестры"
      density="compact"
      variant="solo-filled"
      flat
      rounded
      hide-details
      clearable
      :loading="collectionsLoading"
      prepend-inner-icon="mdi-database-search-outline"
      @update:model-value="onCollectionSelected"
    />

    <v-spacer />

    <v-switch
      v-model="devModeModel"
      class="dev-mode-switch me-2"
      color="warning"
      density="compact"
      hide-details
      label="Dev"
    />

    <v-badge
      v-if="devModeModel"
      :content="remarksBadgeCount"
      :model-value="remarksBadgeCount > 0"
      color="warning"
      class="me-2"
    >
      <v-btn variant="tonal" size="small" prepend-icon="mdi-comment-text-multiple-outline" @click="emit('open-remarks')">
        Правки
      </v-btn>
    </v-badge>

    <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="emit('create-task')"> Новая задача </v-btn>

    <div v-if="currentUserId || currentUserDisplay || status" class="app-navbar__user ms-3">
      <button
        v-if="currentUserId"
        type="button"
        class="app-navbar__user-link text-subtitle-2 font-weight-medium"
        @click="emit('open-current-user')"
      >
        {{ currentUserDisplay || 'Taskflow' }}
      </button>
      <span v-else class="text-subtitle-2 font-weight-medium">{{ currentUserDisplay || 'Taskflow' }}</span>
      <span v-if="status" class="text-caption text-medium-emphasis d-block app-navbar__status">{{ status }}</span>
    </div>

    <v-btn
      v-if="currentUserId"
      class="ms-1"
      variant="text"
      size="small"
      prepend-icon="mdi-logout"
      @click="emit('logout')"
    >
      Выйти
    </v-btn>
  </v-app-bar>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { getApi } from '../main.js';

const props = defineProps({
  currentUserDisplay: { type: String, default: '' },
  currentUserId: { type: String, default: '' },
  status: { type: String, default: '' },
  devMode: { type: Boolean, default: false },
  remarksBadgeCount: { type: Number, default: 0 },
  searchableCollections: { type: Array, default: () => [] },
  collectionsLoading: { type: Boolean, default: false },
});

const emit = defineEmits([
  'update:devMode',
  'open-remarks',
  'create-task',
  'pick-task',
  'pick-entity',
  'open-collection-list',
  'open-current-user',
  'logout',
]);

const selectedCollection = ref(null);

const devModeModel = computed({
  get: () => props.devMode,
  set: (v) => emit('update:devMode', v),
});

const searchWrapRef = ref(null);
const query = ref('');
const groups = ref([]);
const searchLoading = ref(false);
const menuOpen = ref(false);
const searchFocused = ref(false);
let debounceTimer = null;

function groupLabel(group) {
  return group.title || group.collection || '';
}

function closeMenu() {
  menuOpen.value = false;
}

function onSearchBlur() {
  window.setTimeout(() => {
    if (!searchFocused.value) menuOpen.value = false;
  }, 150);
}

function onQueryInput() {
  const q = query.value.trim();
  if (q.length < 3) {
    groups.value = [];
    searchLoading.value = false;
    menuOpen.value = searchFocused.value && q.length > 0;
    return;
  }
  menuOpen.value = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void runSearch(q), 280);
}

async function runSearch(q) {
  const searchGlobal = getApi()?.core?.searchGlobal;
  if (!searchGlobal) return;
  searchLoading.value = true;
  try {
    const response = await searchGlobal({ search: q, limit: 8 });
    groups.value = Array.isArray(response?.groups) ? response.groups : [];
    if (searchFocused.value || query.value.trim().length >= 3) menuOpen.value = true;
  } catch {
    groups.value = [];
  } finally {
    searchLoading.value = false;
  }
}

function pickItem(group, item) {
  const code = String(item?.code || '').trim();
  if (!code) return;
  query.value = '';
  groups.value = [];
  closeMenu();
  const groupTitle = groupLabel(group);
  if (group.kind === 'task') {
    emit('pick-task', { code, title: item.title, groupTitle });
    return;
  }
  emit('pick-entity', { collection: group.collection, code, title: item.title, groupTitle });
}

function pickFirst() {
  for (const group of groups.value) {
    const first = group.items?.[0];
    if (first) {
      pickItem(group, first);
      return;
    }
  }
}

function onCollectionSelected(collection) {
  if (!collection) return;
  const item = props.searchableCollections.find((c) => c.collection === collection);
  emit('open-collection-list', {
    collection,
    title: item?.title || collection,
  });
  selectedCollection.value = null;
}

watch(
  () => props.devMode,
  (active) => {
    if (!active) closeMenu();
  },
);
</script>

<style scoped>
.app-navbar__user {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 240px;
  text-align: right;
  overflow: hidden;
}

.app-navbar__status {
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-navbar__user-link {
  display: inline-block;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: right;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-navbar__user-link:hover {
  text-decoration: underline;
}

.app-navbar__search-wrap {
  flex: 1 1 280px;
  max-width: 520px;
  min-width: 160px;
}

.app-navbar__collections {
  flex: 0 1 200px;
  max-width: 220px;
  min-width: 140px;
}

.app-navbar__search {
  width: 100%;
}

.app-navbar__results {
  min-width: 280px;
  max-width: 520px;
}

@media (max-width: 600px) {
  .app-navbar__search {
    max-width: 100%;
  }

  .dev-mode-switch :deep(.v-label) {
    display: none;
  }
}
</style>
