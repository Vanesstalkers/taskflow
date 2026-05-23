<template>
  <div
    class="app-select-wrap"
    :data-dev-id="devAnchorId"
    :class="{
      'app-select-wrap--success': showSuccessOutline,
      'app-select-wrap--error': showErrorOutline,
    }"
  >
    <v-autocomplete
      ref="rootRef"
      :model-value="modelValue"
      v-model:search="search"
      v-bind="menuBind"
      :class="pickerClass"
      variant="outlined"
      :density="density"
      :single-line="singleLine"
      :items="resolvedItems"
      :loading="loading || searchLoading || saving"
      :error="error || !!saveError"
      :error-messages="saveError ? [saveError] : errorMessages"
      :item-title="itemTitle"
      :item-value="itemValue"
      :label="label"
      :placeholder="placeholder"
      :persistent-placeholder="hasPlaceholder"
      no-filter
      :multiple="multiple"
      clearable
      hide-details="auto"
      :disabled="disabled || saving"
      @update:model-value="handleModelUpdate"
    >
      <template v-if="useCustomItemRow" #item="{ props: listItemProps, item }">
        <v-list-item
          v-bind="listItemProps"
          :class="{ 'multi-entity-picker__item-create': isCreateNewMenuItem(item) }"
        />
      </template>
      <template v-if="hideSelectionChips" #selection />
    </v-autocomplete>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { getApi } from '../main.js';
import { useDevAnchorId } from '../utils/devAnchorId.js';
import { saveField } from '../utils/storeActions.js';
import { useStore } from '../stores/store.js';

defineOptions({ inheritAttrs: false });

const CREATE_NEW_FALLBACK = '__multiEntityPicker_createNew__';

const OUTLINE_FLASH_MS = 2000;

const globalStore = useStore();

const props = defineProps({
  modelValue: { type: [String, Number, Object, Array], default: null },
  /** Явный список; если пусто — `store.lst[lstName]` */
  items: { type: Array, default: () => [] },
  lstName: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  errorMessages: { type: Array, default: () => [] },
  itemTitle: { type: String, default: 'title' },
  itemValue: { type: String, default: 'code' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  syncMenu: { type: Boolean, default: false },
  multiple: { type: Boolean, default: false },
  density: { type: String, default: 'compact' },
  singleLine: { type: Boolean, default: false },
  pickerClass: { type: String, default: '' },
  useCustomItemRow: { type: Boolean, default: false },
  showCreateNewOption: { type: Boolean, default: false },
  createNewSentinel: { type: String, default: CREATE_NEW_FALLBACK },
  hideSelectionChips: { type: Boolean, default: false },
  collection: { type: String, default: '' },
  _id: { type: String, default: '' },
  field: { type: String, default: '' },
  /** Полный devId из manifest; иначе `collection.field` */
  devId: { type: String, default: '' },
  contextKey: { type: String, default: '' },
  /** Поиск по `api.core.search` в коллекции; items — только доп. пункты (напр. «Создать») */
  searchCollection: { type: String, default: '' },
  /** Id уже выбранных записей — подмешиваются из store[searchCollection] для подписи в списке */
  searchPreserveIds: { type: Array, default: () => [] },
  searchLimit: { type: Number, default: 20 },
  searchMinLength: { type: Number, default: 3 },
});

const devAnchorId = useDevAnchorId(props);

const emit = defineEmits(['update:modelValue']);

const search = defineModel('search', { type: String, default: '' });
const menu = defineModel('menu', { type: Boolean, default: false });

const rootRef = ref(null);
const saving = ref(false);
const saveError = ref('');
const lastCommitted = ref('');

const showSuccessOutline = ref(false);
const showErrorOutline = ref(false);
let successOutlineTimer = null;
let errorOutlineTimer = null;

const persistEnabled = computed(() => {
  if (props.multiple) return false;
  const c = String(props.collection || '').trim();
  const id = String(props._id || '').trim();
  const f = String(props.field || '').trim();
  return Boolean(c && id && f);
});

const hasPlaceholder = computed(() => Boolean(String(props.placeholder || '').trim()));

const remoteSearchEnabled = computed(() => Boolean(String(props.searchCollection || '').trim()));
const searchCollectionName = computed(() => String(props.searchCollection || '').trim());

const remoteItems = ref([]);
const searchLoading = ref(false);

function getSearchBucket() {
  const name = searchCollectionName.value;
  if (!name) return null;
  if (!globalStore.store[name]) globalStore.store[name] = {};
  return globalStore.store[name];
}

function pickerRow(record, id) {
  const tk = props.itemTitle;
  const vk = props.itemValue;
  const raw = record && typeof record === 'object' ? record : {};
  const primary = raw[tk];
  if (primary != null && String(primary).trim() !== '') {
    return { [tk]: String(primary), [vk]: String(id) };
  }
  const title = String(raw.login || '').trim() || String(id);
  return { [tk]: title, [vk]: String(id) };
}

function idFromSearchRow(row) {
  if (!row || typeof row !== 'object') return '';
  const vk = props.itemValue;
  return String(row._id ?? row[vk] ?? '').trim();
}

function appendPreserveIds(items) {
  const vk = props.itemValue;
  const map = new Map();
  for (const item of items) {
    const raw = item?.raw ?? item;
    const id = raw != null && typeof raw === 'object' && raw[vk] != null && raw[vk] !== '' ? raw[vk] : item?.[vk];
    if (id == null || id === '') continue;
    map.set(String(id), item);
  }
  const bucket = getSearchBucket();
  if (!bucket) return Array.from(map.values());
  for (const selectedId of props.searchPreserveIds) {
    const key = String(selectedId);
    if (map.has(key)) continue;
    const record = bucket[key];
    if (!record) continue;
    map.set(key, pickerRow(record, key));
  }
  return Array.from(map.values());
}

async function syncRemoteSearchOptions(rawSearch = '') {
  if (!remoteSearchEnabled.value) return;
  const searchMethod = getApi()?.core?.search;
  const query = typeof rawSearch === 'string' ? rawSearch.trim() : '';
  const collection = searchCollectionName.value;
  const minLen = Math.max(1, Number(props.searchMinLength) || 3);

  if (!query || query.length < minLen) {
    if (collection === 'user') {
      const sid = String(globalStore.currentUserId || '').trim();
      const bucket = getSearchBucket();
      const baseline = sid && bucket ? bucket[sid] : null;
      const items = baseline ? [pickerRow(baseline, sid)] : [];
      remoteItems.value = appendPreserveIds(items);
    } else {
      remoteItems.value = appendPreserveIds([]);
    }
    return;
  }

  if (!searchMethod) return;
  searchLoading.value = true;
  try {
    const response = await searchMethod({
      collection,
      search: query,
      limit: Math.min(Math.max(Number(props.searchLimit) || 20, 1), 100),
    });
    const rows = Array.isArray(response?.items) ? response.items : [];
    const items = rows
      .map((row) => {
        const id = idFromSearchRow(row);
        return id ? pickerRow(row, id) : null;
      })
      .filter(Boolean);
    remoteItems.value = appendPreserveIds(items);
    // Ответ search — { code, title }; в store[collection] не пишем (см. mergeDeep / getStoreRecord).
  } catch {
    // оставляем предыдущий список
  } finally {
    searchLoading.value = false;
  }
}

const staticItems = computed(() => {
  const vk = props.itemValue;
  const tk = props.itemTitle;
  let items = [];
  const direct = props.items;
  if (Array.isArray(direct) && direct.length > 0) {
    items = direct;
  } else if (!remoteSearchEnabled.value) {
    const key = String(props.lstName || '').trim();
    if (key) {
      const raw = globalStore.lst[key];
      if (Array.isArray(raw)) items = raw;
    }
  }
  const current = normalizePersistValue(props.modelValue);
  if (current && !items.some((row) => String(row?.[vk] ?? '') === current)) {
    const match = items.find((row) => String(row?.[tk] ?? '') === current);
    items = [{ [tk]: match ? match[tk] : current, [vk]: current }, ...items];
  }
  return items;
});

const resolvedItems = computed(() => {
  if (!remoteSearchEnabled.value) return staticItems.value;
  const prefix = staticItems.value;
  const seen = new Set(prefix.map((row) => String(row?.[props.itemValue] ?? '')));
  const merged = [...prefix];
  for (const row of remoteItems.value) {
    const id = String(row?.[props.itemValue] ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(row);
  }
  return merged;
});

const menuBind = computed(() => {
  if (!props.syncMenu) return {};
  return {
    menu: menu.value,
    'onUpdate:menu': (v) => {
      menu.value = v;
    },
  };
});

function isCreateNewMenuItem(item) {
  if (!props.showCreateNewOption) return false;
  const vk = props.itemValue;
  const raw = item?.raw;
  if (raw && typeof raw === 'object' && raw[vk] === props.createNewSentinel) {
    return true;
  }
  if (item?.value === props.createNewSentinel) return true;
  return typeof item?.title === 'string' && item.title === 'Создать';
}

function normalizePersistValue(val) {
  if (val == null || val === '') return '';
  return String(val);
}

function storedFromModel(raw) {
  return normalizePersistValue(raw);
}

function displayTextForValue(val) {
  const current = normalizePersistValue(val);
  if (!current) return '';
  const vk = props.itemValue;
  const tk = props.itemTitle;
  const hit = resolvedItems.value.find((row) => String(row?.[vk] ?? '') === current);
  if (!hit) return current;
  return String(hit[tk] ?? '').trim() || current;
}

function syncSearchInputFromModel() {
  const next = displayTextForValue(props.modelValue);
  if (search.value !== next) search.value = next;
}

function clearOutlineFlash() {
  clearTimeout(successOutlineTimer);
  clearTimeout(errorOutlineTimer);
  successOutlineTimer = null;
  errorOutlineTimer = null;
  showSuccessOutline.value = false;
  showErrorOutline.value = false;
}

function flashSuccess() {
  showErrorOutline.value = false;
  clearTimeout(errorOutlineTimer);
  errorOutlineTimer = null;
  showSuccessOutline.value = true;
  clearTimeout(successOutlineTimer);
  successOutlineTimer = setTimeout(() => {
    showSuccessOutline.value = false;
    successOutlineTimer = null;
  }, OUTLINE_FLASH_MS);
}

function flashError() {
  showSuccessOutline.value = false;
  clearTimeout(successOutlineTimer);
  successOutlineTimer = null;
  showErrorOutline.value = true;
  clearTimeout(errorOutlineTimer);
  errorOutlineTimer = setTimeout(() => {
    showErrorOutline.value = false;
    errorOutlineTimer = null;
  }, OUTLINE_FLASH_MS);
}

watch(
  () => props.contextKey,
  () => {
    if (persistEnabled.value) {
      lastCommitted.value = storedFromModel(props.modelValue);
    }
    saveError.value = '';
    clearOutlineFlash();
  },
  { immediate: true },
);

watch(
  () => [props.modelValue, resolvedItems.value],
  () => {
    if (!persistEnabled.value) return;
    lastCommitted.value = storedFromModel(props.modelValue);
  },
);

watch(
  () => [props.modelValue, resolvedItems.value],
  () => {
    if (menu.value) return;
    syncSearchInputFromModel();
  },
  { immediate: true },
);

watch(menu, (open) => {
  if (open && props.syncMenu) {
    search.value = '';
    if (remoteSearchEnabled.value) {
      void syncRemoteSearchOptions('');
    }
    return;
  }
  if (!open) syncSearchInputFromModel();
});

watch(
  () => search.value,
  (value) => {
    if (!remoteSearchEnabled.value) return;
    void syncRemoteSearchOptions((value || '').trim());
  },
);

watch(
  () => [props.searchPreserveIds, props.searchCollection, props.contextKey],
  () => {
    if (!remoteSearchEnabled.value) return;
    void syncRemoteSearchOptions((search.value || '').trim());
  },
  { deep: true },
);

onMounted(() => {
  if (remoteSearchEnabled.value) void syncRemoteSearchOptions((search.value || '').trim());
});

onUnmounted(() => {
  clearOutlineFlash();
});

async function persistFromPicker(val) {
  if (props.disabled || saving.value) return;

  const toSave = normalizePersistValue(val);
  if (toSave === lastCommitted.value) return;

  if (!String(props._id || '').trim()) {
    saveError.value = 'Не указан идентификатор записи';
    flashError();
    return;
  }

  saving.value = true;
  saveError.value = '';
  try {
    await saveField({
      collection: String(props.collection).trim(),
      _id: String(props._id).trim(),
      data: { [String(props.field).trim()]: toSave },
    });
    lastCommitted.value = toSave;
    flashSuccess();
  } catch (error) {
    saveError.value = error.message || 'Не удалось сохранить';
    flashError();
  } finally {
    saving.value = false;
  }
}

function handleModelUpdate(val) {
  const normalized = val == null || val === '' ? null : val;
  emit('update:modelValue', normalized);
  if (!persistEnabled.value) return;
  void persistFromPicker(val);
}

function focus() {
  const cmp = rootRef.value;
  if (cmp && typeof cmp.focus === 'function') {
    cmp.focus();
    return;
  }
  const root = cmp?.$el;
  const input = root?.querySelector?.('input:not([type=hidden])');
  input?.focus();
}

defineExpose({ focus });
</script>

<style scoped>
.app-select-wrap {
  display: block;
  width: 100%;
  max-width: 100%;
  border-radius: 4px;
  transition: outline-color 0.15s ease;
}

.app-select-wrap--success {
  outline: 2px solid rgb(var(--v-theme-success));
  outline-offset: 2px;
}

.app-select-wrap--error {
  outline: 2px solid rgb(var(--v-theme-error));
  outline-offset: 2px;
}
</style>
