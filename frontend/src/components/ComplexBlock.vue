<template>
  <div class="multi-entity-picker">
    <div class="multi-entity-picker__labels d-flex flex-wrap ga-2 align-center mb-3">
      <span v-if="selectedKeys.length === 0" class="text-body-2 text-medium-emphasis align-self-center">
        {{ emptyText }}
      </span>

      <div v-for="key in selectedKeys" :key="String(key)" class="multi-entity-picker__label text-body-2">
        <span class="multi-entity-picker__label-text">
          <slot name="label" :_id="String(key)" :record="getStoreRecord(key)">
            {{ key }}
          </slot>
        </span>
        <v-btn
          v-if="linkPersistEnabled"
          type="button"
          icon="mdi-close"
          variant="text"
          density="comfortable"
          size="x-small"
          color="medium-emphasis"
          class="multi-entity-picker__remove"
          :disabled="disabled || removingKey !== null || addingKey !== null || isRemoveBlocked"
          :loading="removingKey === String(key)"
          @click.stop="removeTarget(key)"
        />
      </div>

      <v-btn
        v-if="linkPersistEnabled && !showAddSlot"
        type="button"
        icon="mdi-plus"
        variant="text"
        density="compact"
        size="small"
        class="multi-entity-picker__add-trigger"
        :disabled="disabled || addingKey !== null || removingKey !== null"
        :loading="mergedLoading || addingKey !== null"
        aria-label="Добавить"
        @click="openAddField"
      />

      <div
        v-if="showAddSlot"
        class="multi-entity-picker__add-slot"
        :class="{
          'multi-entity-picker__add-slot--with-create-btn': showSeparateCreateButton,
          'multi-entity-picker__add-slot--create-only': hideSearchInput && showSeparateCreateButton,
        }"
        @focusout="onAddSlotFocusOut"
      >
        <v-autocomplete
          v-if="showSearchInput"
          ref="addFieldRef"
          :model-value="addPickerValue"
          v-model:search="search"
          v-model:menu="addMenuOpen"
          class="multi-entity-picker__add"
          variant="outlined"
          density="compact"
          single-line
          :items="addFieldItems"
          :loading="mergedLoading || addingKey !== null"
          :error="error"
          :error-messages="errorMessages"
          :item-title="itemTitle"
          :item-value="itemValue"
          :label="addFieldLabel"
          :placeholder="addPlaceholder"
          no-filter
          clearable
          hide-details="auto"
          :disabled="disabled || addingKey !== null || removingKey !== null"
          @update:model-value="onAddSelected"
        >
          <template #item="{ props: listItemProps, item }">
            <v-list-item
              v-bind="listItemProps"
              :class="{ 'multi-entity-picker__item-create': isCreateNewMenuItem(item) }"
            />
          </template>
        </v-autocomplete>
        <v-btn
          v-if="showSeparateCreateButton"
          type="button"
          variant="tonal"
          size="small"
          class="multi-entity-picker__create-btn flex-shrink-0 align-self-center"
          :disabled="disabled || addingKey !== null || removingKey !== null"
          :loading="addingKey === ADD_CREATE_NEW_VALUE"
          @click="runCreateNewFromSearch"
        >
          {{ createButtonLabel }}
        </v-btn>
      </div>
    </div>

    <p v-if="error && linkPersistEnabled && !showAddSlot && errorMessages.length" class="text-caption text-error mb-2">
      {{ errorMessages[0] }}
    </p>

    <p v-if="removeError" class="text-caption text-error mb-2">{{ removeError }}</p>

    <v-autocomplete
      v-if="!linkPersistEnabled"
      v-model="selectedKeys"
      v-model:search="search"
      variant="outlined"
      density="comfortable"
      :items="effectiveItems"
      :loading="mergedLoading"
      :error="error"
      :error-messages="errorMessages"
      :item-title="itemTitle"
      :item-value="itemValue"
      :label="pickerLabel"
      no-filter
      multiple
      clearable
      hide-details="auto"
      :disabled="disabled"
    >
      <template #selection />
    </v-autocomplete>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { getApi } from '../api/backend.js';
import { addObject as callAddObject, updateLink as callUpdateLink } from '../utils/storeActions.js';
import { useStore } from '../stores/store.js';

const globalStore = useStore();

const selectedKeys = defineModel({ type: Array, default: () => [] });
const search = defineModel('search', { type: String, default: '' });

const props = defineProps({
  items: { type: Array, default: () => [] },
  itemTitle: { type: String, default: 'title' },
  itemValue: { type: String, default: 'value' },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  errorMessages: { type: Array, default: () => [] },
  emptyText: { type: String, default: '' },
  pickerLabel: { type: String, default: 'Выбрать из списка' },
  /** Подпись у встроенного поля добавления (режим link) */
  addFieldLabel: { type: String, default: '' },
  /** Плейсхолдер поля поиска при `remoteSearch` */
  addPlaceholder: { type: String, default: 'Минимум 3 символа для поиска' },
  _id: { type: String, default: '' },
  /** Ключ среза в глобальном сторе (store.store): подпись из store[collection][id выбранного ключа] */
  collection: { type: String, default: '' },
  parentCollection: { type: String, default: '' },
  parentId: { type: String, default: '' },
  linkField: { type: String, default: '' },
  minSelection: { type: Number, default: 0 },
  contextKey: { type: String, default: '' },
  /** Первый пункт «Создать» в списке добавления (режим link) */
  showCreateNewOption: { type: Boolean, default: true },
  /** Кнопка «Создать» рядом с полем, без пункта в выпадающем списке */
  separateCreateButton: { type: Boolean, default: false },
  /** Текст кнопки при `separateCreateButton` */
  createButtonLabel: { type: String, default: 'Создать' },
  /** Поле документа, куда попадёт введённый текст поиска */
  createField: { type: String, default: 'title' },
  /** Загрузка списка через `api.core.search` по пропу `collection` */
  remoteSearch: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /**
   * Вместе с `separateCreateButton`: показывать поле и кнопку «Создать» сразу, без кнопки «+».
   */
  inlineSeparateCreate: { type: Boolean, default: false },
  /** Скрыть поле поиска / ввод; остаётся кнопка «Создать» (обычно с `separateCreateButton` + `inlineSeparateCreate`). */
  hideSearchInput: { type: Boolean, default: false },
});

const emit = defineEmits([
  'linkRemoved',
  'linkRemoveError',
  'linkAdded',
  'linkAddError',
  /** Выбор пункта «Создать» в списке добавления */
  'createNew',
]);

/** Служебное значение первого пункта списка (не ID сущности) */
const ADD_CREATE_NEW_VALUE = '__multiEntityPicker_createNew__';

const removingKey = ref(null);
const addingKey = ref(null);
const pendingCreateFromStore = ref(false);
const removeError = ref('');
const addPickerValue = ref(null);
/** Поле добавления разворачивается после нажатия «+» */
const addExpanded = ref(false);
const addMenuOpen = ref(false);
const addFieldRef = ref(null);

const remoteOptions = ref([]);
const internalLoading = ref(false);

/** Документ, к которому пишется linkField (API updateLink / addObject) */
const linkParentCollection = computed(() => String(props.parentCollection || '').trim());
const linkParentId = computed(() => String(props.parentId || '').trim());

/** Ключ в store для записей связанной сущности (подписи чипов) */
const entityStoreCollection = computed(() => String(props.collection || '').trim());

const linkPersistEnabled = computed(() =>
  Boolean(linkParentCollection.value && linkParentId.value && props.linkField?.trim()),
);

const showSeparateCreateButton = computed(() => props.showCreateNewOption && props.separateCreateButton);

const hideSearchInput = computed(() => props.hideSearchInput === true || props.hideSearchInput === 'true');

/** Поле поиска в полоске добавления (если не скрыто). */
const showSearchInput = computed(() => !hideSearchInput.value);

/** Учитывает `hideSearchInput`: при скрытом поле не дергаем api.search. */
const effectiveRemoteSearch = computed(() => props.remoteSearch && !hideSearchInput.value);

/** Полоска добавления (поле + опционально кнопка «Создать») видна сразу или после «+». */
const showAddSlot = computed(() => {
  if (!linkPersistEnabled.value) return false;
  if (props.inlineSeparateCreate && props.separateCreateButton) return true;
  return addExpanded.value;
});

const isRemoveBlocked = computed(() => props.minSelection > 0 && selectedKeys.value.length <= props.minSelection);

const mergedLoading = computed(() => props.loading || internalLoading.value);

const effectiveItems = computed(() => (effectiveRemoteSearch.value ? remoteOptions.value : props.items));

const addFieldItems = computed(() => {
  const base = effectiveItems.value;
  if (!props.showCreateNewOption) return base;
  if (props.separateCreateButton) return base;
  const titleKey = props.itemTitle;
  const valueKey = props.itemValue;
  const createRow = {
    [titleKey]: 'Создать',
    [valueKey]: ADD_CREATE_NEW_VALUE,
  };
  return [createRow, ...base];
});

/** Строка опции: сначала `itemTitle`, иначе типичные текстовые поля записи, иначе id */
function pickerRow(record, id) {
  const tk = props.itemTitle;
  const vk = props.itemValue;
  const raw = record && typeof record === 'object' ? record : {};
  const primary = raw[tk];
  if (primary != null && String(primary).trim() !== '') {
    return { [tk]: String(primary), [vk]: String(id) };
  }
  const a = String(raw.login || '').trim();
  const b = String(raw.fullName || '').trim();
  const title = b && a ? `${b} (${a})` : b || a || String(id);
  return { [tk]: title, [vk]: String(id) };
}

function idFromSearchRow(row) {
  if (!row || typeof row !== 'object') return '';
  const vk = props.itemValue;
  return String(row._id ?? row[vk] ?? '').trim();
}

function getEntityBucket() {
  const name = entityStoreCollection.value;
  if (!globalStore.store[name]) globalStore.store[name] = {};
  return globalStore.store[name];
}

function appendSelectedKeysToItems(items) {
  const vk = props.itemValue;
  const map = new Map();
  for (const item of items) {
    const raw = item?.raw ?? item;
    const id = raw != null && typeof raw === 'object' && raw[vk] != null && raw[vk] !== '' ? raw[vk] : item?.[vk];
    if (id == null || id === '') continue;
    map.set(String(id), item);
  }
  const bucket = getEntityBucket();
  for (const selectedId of selectedKeys.value) {
    const key = String(selectedId);
    if (map.has(key)) continue;
    const record = bucket[key];
    if (!record) continue;
    map.set(key, pickerRow(record, key));
  }
  return Array.from(map.values());
}

async function syncRemoteSearchOptions(rawSearch = '') {
  if (!effectiveRemoteSearch.value) return;
  const searchMethod = getApi()?.core?.search;
  const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
  const collection = entityStoreCollection.value;

  if (!search) {
    if (collection === 'user') {
      const sid = String(globalStore.currentUserId || '').trim();
      const bucket = getEntityBucket();
      const baseline = sid && bucket ? bucket[sid] : null;
      const items = baseline ? [pickerRow(baseline, sid)] : [];
      remoteOptions.value = appendSelectedKeysToItems(items);
    } else {
      remoteOptions.value = appendSelectedKeysToItems([]);
    }
    return;
  }
  if (search.length < 3) return;

  if (!searchMethod) return;
  internalLoading.value = true;
  try {
    const response = await searchMethod({ collection, search, limit: 20 });
    const rows = Array.isArray(response?.items) ? response.items : [];
    const items = rows
      .map((row) => {
        const id = idFromSearchRow(row);
        return id ? pickerRow(row, id) : null;
      })
      .filter(Boolean);
    remoteOptions.value = appendSelectedKeysToItems(items);
    const bucket = getEntityBucket();
    for (const row of rows) {
      const id = idFromSearchRow(row);
      if (!id) continue;
      bucket[id] = { ...row, _id: id };
    }
  } catch {
    // оставляем предыдущий список при временных сбоях
  } finally {
    internalLoading.value = false;
  }
}

watch(
  () => search.value,
  async (value) => {
    if (!effectiveRemoteSearch.value) return;
    const s = (value || '').trim();
    if (s.length === 0) {
      await syncRemoteSearchOptions('');
      return;
    }
    if (s.length < 3) return;
    await syncRemoteSearchOptions(s);
  },
);

watch(
  selectedKeys,
  () => {
    if (effectiveRemoteSearch.value) search.value = '';
  },
  { deep: true },
);

watch(
  selectedKeys,
  (next, prev) => {
    if (!pendingCreateFromStore.value) return;
    const prevSet = new Set((prev || []).map((k) => String(k)));
    const createdId = (next || []).map((k) => String(k)).find((k) => k && !prevSet.has(k));
    if (!createdId) return;
    pendingCreateFromStore.value = false;
    emit('linkAdded', { targetId: createdId, created: true });
    emit('createNew', { _id: createdId });
  },
  { deep: true },
);

onMounted(() => {
  if (props.inlineSeparateCreate && props.separateCreateButton) {
    addExpanded.value = true;
  }
  if (effectiveRemoteSearch.value) syncRemoteSearchOptions('');
});

function isCreateNewMenuItem(item) {
  if (!props.showCreateNewOption) return false;
  const vk = props.itemValue;
  const raw = item?.raw;
  if (raw && typeof raw === 'object' && raw[vk] === ADD_CREATE_NEW_VALUE) {
    return true;
  }
  if (item?.value === ADD_CREATE_NEW_VALUE) return true;
  return typeof item?.title === 'string' && item.title === 'Создать';
}

watch(
  () => props.contextKey,
  () => {
    pendingCreateFromStore.value = false;
    removeError.value = '';
    addPickerValue.value = null;
    addExpanded.value = !!(props.inlineSeparateCreate && props.separateCreateButton);
    addMenuOpen.value = false;
    if (effectiveRemoteSearch.value) syncRemoteSearchOptions('');
  },
);

watch(showAddSlot, (open) => {
  if (open && effectiveRemoteSearch.value) {
    const s = (search.value || '').trim();
    void syncRemoteSearchOptions(s.length >= 3 ? s : '');
  }
});

function focusAddInput() {
  const root = addFieldRef.value?.$el;
  const input = root?.querySelector?.('input:not([type=hidden])');
  input?.focus();
}

function openAddField() {
  addExpanded.value = true;
  addMenuOpen.value = false;
  nextTick(() => {
    nextTick(() => focusAddInput());
  });
}

function onAddSlotFocusOut(event) {
  if (props.inlineSeparateCreate && props.separateCreateButton) return;
  const related = event.relatedTarget;
  if (related && typeof related === 'object' && event.currentTarget.contains(related)) return;
  window.setTimeout(() => {
    if (addMenuOpen.value) return;
    const root = event.currentTarget;
    if (root && typeof root.contains === 'function' && document.activeElement && root.contains(document.activeElement)) {
      return;
    }
    addExpanded.value = false;
    search.value = '';
  }, 200);
}

/** Запись из глобального стора для слота `label` и подписей */
function getStoreRecord(key) {
  const k = String(key);
  const collection = entityStoreCollection.value;
  if (!collection) return undefined;
  const bucket = globalStore.store[collection];
  if (!bucket || typeof bucket !== 'object') return undefined;
  return bucket[k];
}

async function runCreateNewFromSearch() {
  if (!props.showCreateNewOption) return;
  if (!linkPersistEnabled.value) {
    emit('createNew');
    if (!(props.inlineSeparateCreate && props.separateCreateButton)) {
      addExpanded.value = false;
    }
    addMenuOpen.value = false;
    search.value = '';
    return;
  }

  const createField = String(props.createField || 'title').trim() || 'title';
  const createValue = String(search.value || '').trim();
  const document = {};
  if (createValue) {
    document[createField] = createValue;
  }

  removeError.value = '';
  addingKey.value = ADD_CREATE_NEW_VALUE;
  try {
    pendingCreateFromStore.value = true;
    await callAddObject({
      collection: props.collection,
      document,
      link: {
        collection: linkParentCollection.value,
        _id: linkParentId.value,
        linkField: props.linkField,
        linkPayload: {},
      },
    });
  } catch (error) {
    pendingCreateFromStore.value = false;
    emit('linkAddError', error.message || 'Не удалось создать и добавить связь');
  } finally {
    addingKey.value = null;
    addMenuOpen.value = false;
    search.value = '';
    if (!(props.inlineSeparateCreate && props.separateCreateButton)) {
      addExpanded.value = false;
    }
  }
}

async function onAddSelected(val) {
  const raw = val;
  if (raw === null || raw === undefined || raw === '') {
    addPickerValue.value = null;
    return;
  }
  const id = String(raw);
  if (id === ADD_CREATE_NEW_VALUE) {
    addPickerValue.value = null;
    await runCreateNewFromSearch();
    return;
  }
  if (!linkPersistEnabled.value) return;
  if (selectedKeys.value.some((k) => String(k) === id)) {
    addPickerValue.value = null;
    return;
  }

  removeError.value = '';
  addingKey.value = id;
  try {
    const _id = linkParentId.value;
    const collection = linkParentCollection.value;
    await callUpdateLink({
      _id,
      collection,
      linkField: props.linkField,
      targetId: id,
      action: 'add',
      linkPayload: {},
      taskType: collection === 'task' ? globalStore.store[collection][_id].taskType : null,
    });
    selectedKeys.value = [...selectedKeys.value, id];
    emit('linkAdded', { targetId: id });
  } catch (error) {
    emit('linkAddError', error.message || 'Не удалось добавить связь');
  } finally {
    addingKey.value = null;
    addPickerValue.value = null;
    addMenuOpen.value = false;
    search.value = '';
    if (!(props.inlineSeparateCreate && props.separateCreateButton)) {
      addExpanded.value = false;
    }
  }
}

async function removeTarget(key) {
  if (!linkPersistEnabled.value || removingKey.value !== null) return;
  const targetId = String(key);
  if (props.minSelection > 0 && selectedKeys.value.length - 1 < props.minSelection) {
    removeError.value = `Нужно оставить не меньше ${props.minSelection}`;
    emit('linkRemoveError', removeError.value);
    return;
  }

  removeError.value = '';
  removingKey.value = targetId;
  try {
    await callUpdateLink({
      _id: linkParentId.value,
      collection: linkParentCollection.value,
      linkField: props.linkField,
      targetId,
      action: 'remove',
    });
    selectedKeys.value = selectedKeys.value.filter((k) => String(k) !== targetId);
    emit('linkRemoved', { targetId });
  } catch (error) {
    removeError.value = error.message || 'Не удалось удалить связь';
    emit('linkRemoveError', removeError.value);
  } finally {
    removingKey.value = null;
  }
}
</script>

<style scoped>
.multi-entity-picker__label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 4px 4px 12px;
  border-radius: 6px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-on-surface));
  max-width: 100%;
  word-break: break-word;
  user-select: none;
}

.multi-entity-picker__label-text {
  min-width: 0;
}

.multi-entity-picker__add-trigger {
  flex-shrink: 0;
  align-self: center;
  width: 30px;
  min-width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 6px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.multi-entity-picker__add-trigger :deep(.v-icon) {
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.72;
}

.multi-entity-picker__add-trigger:hover:not(:disabled) {
  background-color: rgba(var(--v-theme-on-surface), 0.12);
}

.multi-entity-picker__add-trigger:hover:not(:disabled) :deep(.v-icon) {
  opacity: 1;
}

.multi-entity-picker__add-slot {
  flex: 1 1 200px;
  min-width: 180px;
  max-width: 320px;
  align-self: center;
}

.multi-entity-picker__add-slot--with-create-btn {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  flex: 1 1 100%;
}

.multi-entity-picker__add-slot--create-only {
  flex: 0 0 auto;
  min-width: 0;
  max-width: none;
  width: auto;
}

.multi-entity-picker__add-slot--with-create-btn .multi-entity-picker__add {
  flex: 1 1 200px;
  min-width: 160px;
  max-width: none;
}

.multi-entity-picker__create-btn {
  min-width: 88px;
}

.multi-entity-picker__add {
  width: 100%;
}

/* В одну линию с чипами: та же «пилюля», высота и типографика */
.multi-entity-picker__add :deep(.v-field--variant-outlined) {
  border-radius: 6px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.multi-entity-picker__add :deep(.v-field--variant-outlined .v-field__outline) {
  --v-field-border-opacity: 0.18;
}

.multi-entity-picker__add :deep(.v-field--focused.v-field--variant-outlined .v-field__outline) {
  --v-field-border-opacity: 0.5;
}

.multi-entity-picker__add :deep(.v-field) {
  min-height: 30px;
}

.multi-entity-picker__add :deep(.v-field__field) {
  align-items: center;
  padding-top: 0;
  padding-bottom: 0;
}

.multi-entity-picker__add :deep(.v-field__input) {
  min-height: 28px;
  padding-block: 4px;
  padding-inline: 12px 4px;
}

.multi-entity-picker__add :deep(.v-field__input input) {
  font-size: inherit;
  line-height: 1.25rem;
}

.multi-entity-picker__add :deep(.v-field__append-inner) {
  padding-top: 0;
  margin-inline-end: 2px;
  align-items: center;
}

.multi-entity-picker__add :deep(.v-field__append-inner .v-btn) {
  width: 24px;
  height: 24px;
}

.multi-entity-picker__remove {
  flex-shrink: 0;
  margin-inline-end: -2px;
}

.multi-entity-picker__remove :deep(.v-icon) {
  color: rgb(var(--v-theme-on-surface)) !important;
  opacity: 0.62;
}

.multi-entity-picker__remove:hover:not(:disabled) :deep(.v-icon) {
  opacity: 1;
}
</style>

<style>
.multi-entity-picker__item-create {
  background-color: rgba(var(--v-theme-success), 0.1);
}

.multi-entity-picker__item-create .v-list-item-title {
  color: rgb(var(--v-theme-success));
  font-weight: 600;
}

.multi-entity-picker__item-create:hover,
.multi-entity-picker__item-create.v-list-item--active {
  background-color: rgba(var(--v-theme-success), 0.16);
}
</style>
