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
      :disabled="fieldDisabled || saving"
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { getApi } from '../main.js';
import { useTaskFieldDisabled } from '../composables/useTaskFieldDisabled.js';
import { useDevAnchorId } from '../utils/devAnchorId.js';
import { saveField } from '../utils/storeActions.js';
import { useStore } from '../stores/store.js';
import { formatUserLabel, fioFromSearchTitle, loginFromSearchTitle, normalizeUserLogin, userMatchesSearchQuery } from '../utils/userLabel.js';

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
  accessPath: { type: String, default: '' },
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
const fieldDisabled = useTaskFieldDisabled(props);

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

function pickerLabel(record, id) {
  const tk = props.itemTitle;
  const raw = record && typeof record === 'object' ? record : {};
  const key = String(id);

  if (searchCollectionName.value === 'user') {
    const fromGlobal = globalStore.store.user?.[key];
    const label = formatUserLabel(fromGlobal || raw, globalStore.store);
    if (label && label !== key) return label;
  }

  const fromStore =
    searchCollectionName.value === 'user' && tk === 'login'
      ? String(getSearchBucket()?.[key]?.login ?? globalStore.store.user?.[key]?.login ?? '').trim()
      : '';

  let label = String(raw[tk] ?? '').trim();
  if (!label || label === key) label = String(raw.title ?? raw.login ?? '').trim();
  if ((!label || label === key) && fromStore) label = fromStore;
  return label && label !== key ? label : key;
}

function pickerRow(record, id) {
  const tk = props.itemTitle;
  const vk = props.itemValue;
  const key = String(id);
  return { [tk]: pickerLabel(record, key), [vk]: key };
}

function idFromSearchRow(row) {
  if (!row || typeof row !== 'object') return '';
  const vk = props.itemValue;
  // core/search отдаёт { code, title }; в store часто _id
  return String(row._id ?? row[vk] ?? row.code ?? '').trim();
}

function userRecordForId(id) {
  const key = String(id);
  const bucket = getSearchBucket();
  return (
    bucket?.[key] ||
    (searchCollectionName.value === 'user' ? globalStore.store.user?.[key] : undefined)
  );
}

function shouldShowUserRecord(record, query) {
  if (searchCollectionName.value !== 'user') return !String(query || '').trim();
  return userMatchesSearchQuery(record, query, globalStore.store);
}

function currentUserBaselineItems(query = '') {
  if (searchCollectionName.value !== 'user') return [];
  const sid = String(globalStore.currentUserId || '').trim();
  if (!sid) return [];
  const record = userRecordForId(sid);
  if (!record || !shouldShowUserRecord(record, query)) return [];
  return [pickerRow(record, sid)];
}

function appendPreserveIds(items, query = '') {
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
    const record = userRecordForId(key);
    if (!record || !shouldShowUserRecord(record, query)) continue;
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
    remoteItems.value = appendPreserveIds(currentUserBaselineItems(query), query);
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
    remoteItems.value = appendPreserveIds([...currentUserBaselineItems(query), ...items], query);
    const bucket = getSearchBucket();
    const storeField = String(props.itemTitle || 'title').trim();
    if (bucket && storeField && storeField !== '_id') {
      for (const row of rows) {
        const id = idFromSearchRow(row);
        const text = String(row?.[storeField] ?? row?.title ?? '').trim();
        if (!id || !text) continue;
        const prev = bucket[id] || globalStore.store.user?.[id] || {};
        if (!bucket[id]) bucket[id] = { _id: id };
        if (collection === 'user' && storeField === 'login') {
          const title = String(row?.title ?? text).trim();
          const login =
            normalizeUserLogin(prev.login) || loginFromSearchTitle(title) || text;
          bucket[id].login = login;
          if (title) bucket[id].displayTitle = title;
          const fio = fioFromSearchTitle(title);
          if (fio) bucket[id]._fio = fio;
          if (prev.pp && typeof prev.pp === 'object') bucket[id].pp = prev.pp;
        } else {
          bucket[id][storeField] = text;
        }
      }
    }
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
  // При remote search выбранные id подмешивает resolvedItems; иначе String([id]) → id в подписи
  if (remoteSearchEnabled.value) return items;

  const model = props.modelValue;
  if (Array.isArray(model) && props.multiple) {
    for (const rawId of model) {
      const id = String(rawId ?? '').trim();
      if (!id || items.some((row) => String(row?.[vk] ?? '') === id)) continue;
      items.push({ [tk]: id, [vk]: id });
    }
    return items;
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
  const vk = props.itemValue;
  const prefix = staticItems.value;
  const seen = new Set(prefix.map((row) => String(row?.[vk] ?? '')));
  const merged = [...prefix];
  for (const row of remoteItems.value) {
    const id = String(row?.[vk] ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(pickerRow(row, id));
  }
  const query = String(search.value || '').trim();
  for (const selectedId of props.searchPreserveIds) {
    const key = String(selectedId);
    if (!key || seen.has(key)) continue;
    const record = userRecordForId(key);
    if (!record || !shouldShowUserRecord(record, query)) continue;
    const row = pickerRow(record, key);
    merged.push(row);
    seen.add(key);
  }
  if (searchCollectionName.value === 'user') {
    const sid = String(globalStore.currentUserId || '').trim();
    if (sid && !seen.has(sid)) {
      const record = userRecordForId(sid);
      if (record && shouldShowUserRecord(record, query)) {
        merged.push(pickerRow(record, sid));
      }
    }
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
  if (props.multiple && props.hideSelectionChips) return;
  const next = displayTextForValue(props.modelValue);
  if (search.value !== next) search.value = next;
}

function clearSearchInput() {
  if (search.value !== '') search.value = '';
}

function selectedIdSet() {
  const raw = props.modelValue;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((v) => String(v)).filter(Boolean));
}

/** Vuetify после выбора подставляет в search item-value (_id), а не подпись */
function isSearchLeakedSelectionId(value) {
  if (!props.multiple || !props.hideSelectionChips) return false;
  const s = String(value || '').trim();
  if (!s) return false;
  if (selectedIdSet().has(s)) return true;
  const vk = props.itemValue;
  return resolvedItems.value.some((row) => String(row?.[vk] ?? '') === s);
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
    if (props.multiple && props.hideSelectionChips) return;
    syncSearchInputFromModel();
  },
  { immediate: true },
);

watch(
  () => props.modelValue,
  () => {
    if (!props.multiple || !props.hideSelectionChips) return;
    if (menu.value) return;
    clearSearchInput();
  },
  { deep: true },
);

watch(menu, (open) => {
  if (open && props.syncMenu) {
    clearSearchInput();
    if (remoteSearchEnabled.value) {
      void syncRemoteSearchOptions('');
    }
    return;
  }
  if (!open) {
    if (props.multiple && props.hideSelectionChips) {
      clearSearchInput();
      return;
    }
    syncSearchInputFromModel();
  }
});

watch(
  () => search.value,
  (value) => {
    if (isSearchLeakedSelectionId(value)) {
      clearSearchInput();
      return;
    }
    if (!remoteSearchEnabled.value) return;
    void syncRemoteSearchOptions((value || '').trim());
  },
);

watch(
  () => [props.searchPreserveIds, props.searchCollection, props.contextKey],
  () => {
    if (!remoteSearchEnabled.value) return;
    hydrateSearchBucketFromStore();
    void syncRemoteSearchOptions((search.value || '').trim());
  },
  { deep: true },
);

function hydrateSearchBucketFromStore() {
  const bucket = getSearchBucket();
  if (!bucket || searchCollectionName.value !== 'user') return;
  const tk = props.itemTitle;
  if (tk !== 'login') return;
  for (const selectedId of props.searchPreserveIds) {
    const key = String(selectedId);
    if (!key) continue;
    const login = String(globalStore.store.user?.[key]?.login ?? '').trim();
    if (!login) continue;
    if (!bucket[key]) bucket[key] = { _id: key };
    if (!String(bucket[key].login ?? '').trim()) bucket[key].login = login;
  }
}

onMounted(() => {
  if (!remoteSearchEnabled.value) return;
  hydrateSearchBucketFromStore();
  void syncRemoteSearchOptions((search.value || '').trim());
});

onUnmounted(() => {
  clearOutlineFlash();
});

async function persistFromPicker(val) {
  if (fieldDisabled.value || saving.value) return;

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
  if (props.multiple && props.hideSelectionChips) {
    clearSearchInput();
    void nextTick(() => clearSearchInput());
  }
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
