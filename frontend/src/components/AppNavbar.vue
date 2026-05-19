<template>
  <v-app-bar elevation="1" density="comfortable" class="app-navbar border-b">
    <v-app-bar-title class="app-navbar__title">
      <span class="text-subtitle-1 font-weight-medium">{{ currentUserDisplay || 'Taskflow' }}</span>
      <span v-if="status" class="text-caption text-medium-emphasis d-block">{{ status }}</span>
    </v-app-bar-title>

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
  </v-app-bar>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { getApi } from '../main.js';

const props = defineProps({
  currentUserDisplay: { type: String, default: '' },
  status: { type: String, default: '' },
  devMode: { type: Boolean, default: false },
  remarksBadgeCount: { type: Number, default: 0 },
});

const emit = defineEmits(['update:devMode', 'open-remarks', 'create-task', 'pick-task', 'pick-entity']);

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
  if (group.kind === 'task') {
    emit('pick-task', code);
    return;
  }
  emit('pick-entity', { collection: group.collection, code, title: item.title });
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

watch(
  () => props.devMode,
  (active) => {
    if (!active) closeMenu();
  },
);
</script>

<style scoped>
.app-navbar__title {
  flex: 0 1 auto;
  min-width: 120px;
  max-width: 200px;
  overflow: hidden;
}

.app-navbar__search-wrap {
  flex: 1 1 280px;
  max-width: 520px;
  min-width: 160px;
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
