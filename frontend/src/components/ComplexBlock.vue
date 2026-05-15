<template>
  <div class="multi-entity-picker" :data-dev-id="devAnchorId">
    <div
      v-if="showBlockTitle"
      class="multi-entity-picker__block-title text-subtitle-2 text-high-emphasis mb-2"
    >
      {{ blockTitleDisplay }}
    </div>
    <div class="multi-entity-picker__labels d-flex flex-wrap ga-2 align-center mb-3">
      <span v-if="selectedKeys.length === 0" class="text-body-2 text-medium-emphasis align-self-center">
        {{ flat.emptyText }}
      </span>

      <div
        v-for="key in selectedKeys"
        :key="String(key)"
        class="multi-entity-picker__label text-body-2"
        :class="{ 'multi-entity-picker__label--full-width': flat.fullWidthLabels }"
      >
        <component
          :is="flat.fullWidthLabels ? 'div' : 'span'"
          class="multi-entity-picker__label-text"
          :class="{ 'multi-entity-picker__label-text--full-width': flat.fullWidthLabels }"
        >
          <slot name="label" :_id="String(key)" :record="getStoreRecord(key)">
            {{ key }}
          </slot>
        </component>
        <v-btn
          v-if="linkPersistEnabled && !isRemoveBlocked"
          type="button"
          icon="mdi-close"
          variant="text"
          density="comfortable"
          size="x-small"
          color="medium-emphasis"
          class="multi-entity-picker__remove"
          :disabled="flat.disabled || removingKey !== null || addingKey !== null"
          :loading="removingKey === String(key)"
          @click.stop="requestRemove(key, $event)"
        />
      </div>

      <template v-if="canAddMoreLinks">
        <v-btn
          v-if="!showAddSlot"
          type="button"
          icon="mdi-plus"
          variant="text"
          density="compact"
          size="small"
          class="multi-entity-picker__add-trigger"
          :disabled="flat.disabled || addingKey !== null || removingKey !== null"
          :loading="mergedLoading || addingKey !== null"
          aria-label="Добавить"
          @click="openAddField"
        />

        <div
          v-if="showAddSlot"
          class="multi-entity-picker__add-slot"
          :class="{
            'multi-entity-picker__add-slot--with-create-btn': showSeparateCreateButton,
            'multi-entity-picker__add-slot--create-only':
              hideSearchInput &&
              (showSeparateCreateButton || showAddViaFileInput || showSeparateCreateInput),
            'multi-entity-picker__add-slot--file-add': showAddViaFileInput,
            'multi-entity-picker__add-slot--radio-pick': showPickRadioGroup,
          }"
          @focusout="onAddSlotFocusOut"
        >
        <Radio
          v-if="showPickRadioGroup"
          :model-value="radioPickValue"
          :field-label="flat.addFieldLabel"
          :items="pickRadioItems"
          :item-title="flat.itemTitle"
          :item-value="flat.itemValue"
          :disabled="flat.disabled || addingKey !== null || removingKey !== null"
          @update:model-value="onRadioPickDocument"
        />
        <Select
          v-else-if="showSearchInput"
          ref="addFieldRef"
          :model-value="addPickerValue"
          v-model:search="search"
          v-model:menu="addMenuOpen"
          picker-class="multi-entity-picker__add"
          sync-menu
          use-custom-item-row
          :items="addFieldItems"
          :loading="mergedLoading || addingKey !== null"
          :error="flat.error"
          :error-messages="flat.errorMessages"
          :item-title="flat.itemTitle"
          :item-value="flat.itemValue"
          :label="flat.addFieldLabel"
          :placeholder="flat.addPlaceholder"
          :disabled="flat.disabled || addingKey !== null || removingKey !== null"
          :show-create-new-option="flat.showCreateNewOption"
          :create-new-sentinel="ADD_CREATE_NEW_VALUE"
          @update:model-value="onAddSelected"
        />
        <Input
          v-if="showSeparateCreateInput"
          ref="createInputRef"
          v-model="search"
          ephemeral
          :loading="addingKey === ADD_CREATE_NEW_VALUE"
          class="multi-entity-picker__add"
          :label="flat.addFieldLabel"
          :placeholder="flat.addPlaceholder"
          autocomplete="off"
          :disabled="flat.disabled || addingKey !== null || removingKey !== null"
          :context-key="`${String(flat.contextKey || flat.parentId || '')}:separate-create-input`"
          @commit="runCreateNew"
        />
        <v-btn
          v-else-if="showSeparateCreateButton"
          type="button"
          variant="tonal"
          size="small"
          class="multi-entity-picker__create-btn flex-shrink-0 align-self-center"
          :disabled="flat.disabled || addingKey !== null || removingKey !== null"
          :loading="addingKey === ADD_CREATE_NEW_VALUE"
          @click="runCreateNew"
        >
          {{ flat.createButtonLabel }}
        </v-btn>
        <InputFile
          v-if="showAddViaFileInput"
          :collection="entityStoreCollection"
          :field="flat.addFileField"
          :label="flat.addFileLabel"
          :multiple="flat.addFileMultiple"
          :create-linked-document="createLinkedDocument"
          :disabled="flat.disabled || addingKey !== null || removingKey !== null"
          :context-key="`${String(flat.contextKey || flat.parentId || '')}:add-file`"
        />
        </div>
      </template>
    </div>

    <p v-if="flat.error && linkPersistEnabled && !showAddSlot && flat.errorMessages.length" class="text-caption text-error mb-2">
      {{ flat.errorMessages[0] }}
    </p>

    <p v-if="removeError" class="text-caption text-error mb-2">{{ removeError }}</p>

    <p v-if="linkAddError" class="text-caption text-error mb-2">{{ linkAddError }}</p>

    <Select
      v-if="!linkPersistEnabled"
      :model-value="selectedKeys"
      v-model:search="search"
      multiple
      density="comfortable"
      :single-line="false"
      hide-selection-chips
      :items="effectiveItems"
      :loading="mergedLoading"
      :error="flat.error"
      :error-messages="flat.errorMessages"
      :item-title="flat.itemTitle"
      :item-value="flat.itemValue"
      :label="flat.pickerLabel"
      :disabled="flat.disabled"
      @update:model-value="onNonLinkSelectionUpdate"
    />
  </div>

  <teleport to="body">
    <div
      v-if="removeConfirmOpen"
      ref="removeConfirmEl"
      class="multi-entity-picker__remove-confirm-tooltip"
      :style="{ left: `${removeConfirmX}px`, top: `${removeConfirmY}px` }"
      role="tooltip"
      aria-live="polite"
      @click.stop
    >
      <div v-if="resolvedRemoveConfirmText" class="multi-entity-picker__remove-confirm-text text-body-2">
        {{ resolvedRemoveConfirmText }}
      </div>
      <div class="multi-entity-picker__remove-confirm-actions">
        <v-btn
          type="button"
          variant="tonal"
          color="error"
          density="comfortable"
          size="small"
          :disabled="flat.disabled || removingKey !== null || addingKey !== null"
          @click="confirmRemove"
        >
          Удалить
        </v-btn>
        <v-btn
          type="button"
          variant="text"
          density="comfortable"
          size="small"
          @click="cancelRemove"
        >
          Отмена
        </v-btn>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { getApi } from '../main.js';
import { addObject as callAddObject, updateLink as callUpdateLink } from '../utils/storeActions.js';
import { useStore } from '../stores/store.js';
import Input from './Input.vue';
import InputFile from './InputFile.vue';
import Radio from './Radio.vue';
import Select from './Select.vue';
import { buildLinkPartialDevId } from '../utils/devAnchorLink.js';

const globalStore = useStore();

const selectedKeys = defineModel({ type: Array, default: () => [] });
const search = defineModel('search', { type: String, default: '' });

const props = defineProps({
  /** Связь и контекст: коллекция сущности, родитель, поле связи, ключ для сброса/фокуса */
  persist: { type: Object, default: () => ({}) },
  /** Список: `items`, поля строки; либо `lstName` — ключ в `store.lst` */
  list: { type: Object, default: () => ({}) },
  /** Подписи и сообщения: emptyText, pickerLabel, blockTitle, … */
  texts: { type: Object, default: () => ({}) },
  /** loading, error, errorMessages */
  status: { type: Object, default: () => ({}) },
  /**
   * addType, addPlacement, minSelection, maxSelection, showCreateNewOption,
   * separateCreateButton (select/search — отдельная кнопка «Создать»; button+collapsed — один клик «+»),
   * createButtonLabel, createField, pickCreatesDocument, pickDocumentField,
   * allowDuplicatePickField (по умолчанию true при pickCreatesDocument; false — не давать повторять значение pickDocumentField, как для ролей),
   * addFileField, addFileLabel, addFileMultiple
   */
  add: { type: Object, default: () => ({}) },
  ui: { type: Object, default: () => ({}) },
  /** Полный devId; иначе `link.{parentCollection}.{linkField}` */
  devId: { type: String, default: '' },
});

const emit = defineEmits([
  'linkRemoved',
  'linkRemoveError',
  'linkAdded',
  'linkAddError',
  /** Выбор пункта «Создать» в списке добавления */
  'createNew',
]);

const ADD_TYPES = ['select', 'search', 'radio', 'input', 'button', 'file'];

function normalizeAddType(v) {
  const s = String(v || '').toLowerCase().trim();
  return ADD_TYPES.includes(s) ? s : '';
}

function normalizeAddPlacement(v) {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'inline' || s === 'collapsed') return s;
  return '';
}

/** Служебное значение первого пункта списка (не ID сущности) */
const ADD_CREATE_NEW_VALUE = '__multiEntityPicker_createNew__';

const removingKey = ref(null);
const addingKey = ref(null);
const pendingCreateFromStore = ref(false);
let pendingCreateResolve = null;
const removeError = ref('');
/** Ошибка добавления связи / создания объекта (показ внутри блока + `linkAddError` для родителя). */
const linkAddError = ref('');

function reportLinkAddError(payload) {
  let text = '';
  if (typeof payload === 'string') text = payload.trim();
  else if (payload && typeof payload.message === 'string') text = String(payload.message).trim();
  if (!text) text = 'Не удалось добавить';
  linkAddError.value = text;
  emit('linkAddError', text);
}

function clearLinkAddError() {
  linkAddError.value = '';
}
const addPickerValue = ref(null);
/** Значение `item-value` в режиме `addType="radio"` (сбрасывается после добавления). */
const radioPickValue = ref(null);
const removeConfirmOpen = ref(false);
const removeConfirmKey = ref(null);
const removeConfirmX = ref(0);
const removeConfirmY = ref(0);
const removeConfirmEl = ref(null);
/** Поле добавления разворачивается после нажатия «+» */
const addExpanded = ref(false);
const addMenuOpen = ref(false);
const addFieldRef = ref(null);
const createInputRef = ref(null);

const remoteOptions = ref([]);
const internalLoading = ref(false);

function obj(x) {
  return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
}

/** Плоские значения с учётом групп `persist` / `list` / `texts` / … и дефолтов */
const devAnchorId = computed(() => {
  if (props.devId) return String(props.devId).trim();
  return buildLinkPartialDevId(obj(props.persist)) || undefined;
});

const flat = computed(() => {
  const persist = obj(props.persist);
  const list = obj(props.list);
  const texts = obj(props.texts);
  const status = obj(props.status);
  const add = obj(props.add);
  const ui = obj(props.ui);

  const minSel = Number(add.minSelection ?? 0);
  const maxSel = Number(add.maxSelection ?? 0);

  return {
    collection: String(persist.collection ?? '').trim(),
    parentCollection: String(persist.parentCollection ?? '').trim(),
    parentId: String(persist.parentId ?? '').trim(),
    linkField: String(persist.linkField ?? '').trim(),
    contextKey: String(persist.contextKey ?? '').trim(),

    listItemsRaw: Array.isArray(list.items) ? list.items : [],
    listLstName: String(list.lstName ?? '').trim(),
    itemTitle: String(list.itemTitle ?? 'title'),
    itemValue: String(list.itemValue ?? 'code'),

    emptyText: String(texts.emptyText ?? ''),
    blockTitle: String(texts.blockTitle ?? ''),
    pickerLabel: String(texts.pickerLabel ?? 'Выбрать из списка'),
    addFieldLabel: String(texts.addFieldLabel ?? ''),
    addPlaceholder: String(texts.addPlaceholder ?? 'Минимум 3 символа для поиска'),
    maxSelectionMessage: String(texts.maxSelectionMessage ?? ''),
    removeConfirmText: String(texts.removeConfirmText ?? ''),

    minSelection: Number.isFinite(minSel) ? minSel : 0,
    maxSelection: Number.isFinite(maxSel) ? maxSel : 0,

    loading: Boolean(status.loading),
    error: Boolean(status.error),
    errorMessages: Array.isArray(status.errorMessages) ? status.errorMessages : [],

    addType: String(add.addType ?? 'select'),
    addPlacement: String(add.addPlacement ?? 'collapsed'),
    showCreateNewOption: add.showCreateNewOption !== false,
    separateCreateButton: Boolean(add.separateCreateButton),
    createButtonLabel: String(add.createButtonLabel ?? 'Добавить'),
    createField: String(add.createField ?? 'title'),
    pickCreatesDocument: Boolean(add.pickCreatesDocument),
    pickDocumentField: String(add.pickDocumentField ?? 'type'),
    /** По умолчанию true: при pickCreatesDocument одно значение списка можно выбрать несколько раз. Для ролей и т.п. передайте false. */
    allowDuplicatePickField: add.allowDuplicatePickField !== false,
    addFileField: String(add.addFileField ?? 'fileName'),
    addFileLabel: String(add.addFileLabel ?? 'Добавить файлы'),
    addFileMultiple: add.addFileMultiple !== false,

    disabled: Boolean(ui.disabled),
    fullWidthLabels: Boolean(ui.fullWidthLabels ?? true),
  };
});

const blockTitleDisplay = computed(() => String(flat.value.blockTitle || '').trim());
const showBlockTitle = computed(() => blockTitleDisplay.value.length > 0);

const linkParentCollection = computed(() => flat.value.parentCollection);
const linkParentId = computed(() => flat.value.parentId);
const entityStoreCollection = computed(() => flat.value.collection);

const linkPersistEnabled = computed(() =>
  Boolean(flat.value.parentCollection && flat.value.parentId && flat.value.linkField),
);

const resolvedAddType = computed(() => normalizeAddType(flat.value.addType) || 'select');

const explicitAddPlacement = computed(() => normalizeAddPlacement(flat.value.addPlacement));

const addPlacementResolved = computed(() => {
  const ex = explicitAddPlacement.value;
  return ex === 'inline' ? 'inline' : 'collapsed';
});

const hideSearchInput = computed(() => {
  const t = resolvedAddType.value;
  return t === 'input' || t === 'button' || t === 'file' || t === 'radio';
});

const showAddViaFileInput = computed(() => linkPersistEnabled.value && resolvedAddType.value === 'file');

/** Поле поиска в полоске добавления (если не скрыто). */
const showSearchInput = computed(() => !hideSearchInput.value);

const effectiveRemoteSearch = computed(() => resolvedAddType.value === 'search');

const showSeparateCreateButton = computed(() => {
  if (!linkPersistEnabled.value || !flat.value.showCreateNewOption) return false;
  if (resolvedAddType.value === 'button') return true;
  if (resolvedAddType.value === 'input' || resolvedAddType.value === 'file' || resolvedAddType.value === 'radio') {
    return false;
  }
  return flat.value.separateCreateButton;
});

const showSeparateCreateInput = computed(
  () =>
    linkPersistEnabled.value &&
    flat.value.showCreateNewOption &&
    !showAddViaFileInput.value &&
    resolvedAddType.value === 'input',
);

/** Полоска добавления видна сразу или после «+». */
const showAddSlot = computed(() => {
  if (!linkPersistEnabled.value) return false;
  if (
    addPlacementResolved.value === 'collapsed' &&
    resolvedAddType.value === 'button' &&
    flat.value.separateCreateButton
  ) {
    return false;
  }
  if (addPlacementResolved.value === 'inline') return true;
  return addExpanded.value;
});

const isRemoveBlocked = computed(() => flat.value.minSelection > 0 && selectedKeys.value.length <= flat.value.minSelection);

const maxSelectionEffective = computed(() => {
  const n = Number(flat.value.maxSelection);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
});

const resolvedMaxSelectionMessage = computed(() => {
  const custom = String(flat.value.maxSelectionMessage || '').trim();
  if (custom) return custom;
  const lim = maxSelectionEffective.value;
  return lim != null ? `Можно добавить не более ${lim}` : '';
});

const resolvedRemoveConfirmText = computed(() => {
  const custom = String(flat.value.removeConfirmText || '').trim();
  if (custom) return custom;
  return '';
});

const isAddBlocked = computed(
  () => maxSelectionEffective.value != null && selectedKeys.value.length >= maxSelectionEffective.value,
);

/** Показ всех контролов добавления связи (кнопка «+» и полоска); скрывается целиком при достижении maxSelection */
const canAddMoreLinks = computed(() => linkPersistEnabled.value && !isAddBlocked.value);

const mergedLoading = computed(() => flat.value.loading || internalLoading.value);

const catalogItems = computed(() => {
  const raw = flat.value.listItemsRaw;
  if (Array.isArray(raw) && raw.length > 0) return raw;
  const key = flat.value.listLstName;
  if (!key) return [];
  const arr = globalStore.lst[key];
  return Array.isArray(arr) ? arr : [];
});

const effectiveItems = computed(() => (effectiveRemoteSearch.value ? remoteOptions.value : catalogItems.value));

const pickRadioItems = computed(() => {
  if (!flat.value.pickCreatesDocument || resolvedAddType.value !== 'radio') return [];
  const items = effectiveItems.value;
  return Array.isArray(items) ? items : [];
});

const showPickRadioGroup = computed(
  () =>
    linkPersistEnabled.value &&
    flat.value.pickCreatesDocument &&
    resolvedAddType.value === 'radio' &&
    pickRadioItems.value.length > 0,
);

const addFieldItems = computed(() => {
  const base = effectiveItems.value;
  if (!flat.value.showCreateNewOption) return base;
  if (
    showSeparateCreateButton.value &&
    (resolvedAddType.value === 'select' || resolvedAddType.value === 'search')
  ) {
    return base;
  }
  if (resolvedAddType.value !== 'select' && resolvedAddType.value !== 'search') return base;
  const titleKey = flat.value.itemTitle;
  const valueKey = flat.value.itemValue;
  const createRow = {
    [titleKey]: 'Создать',
    [valueKey]: ADD_CREATE_NEW_VALUE,
  };
  return [createRow, ...base];
});

/** Строка опции: сначала `itemTitle`, иначе типичные текстовые поля записи, иначе `_id` / ключ значения */
function pickerRow(record, id) {
  const tk = flat.value.itemTitle;
  const vk = flat.value.itemValue;
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
  const vk = flat.value.itemValue;
  return String(row._id ?? row[vk] ?? '').trim();
}

async function runPickCreatesDocumentAdd(pickId) {
  const id = String(pickId || '').trim();
  if (!id || !linkPersistEnabled.value) return;

  if (isAddBlocked.value) {
    reportLinkAddError(resolvedMaxSelectionMessage.value);
    radioPickValue.value = null;
    return;
  }

  const field = String(flat.value.pickDocumentField || 'type').trim() || 'type';
  if (!flat.value.allowDuplicatePickField) {
    const bucket = getEntityBucket();
    for (const key of selectedKeys.value) {
      const rec = bucket[String(key)];
      if (rec && String(rec[field] ?? '') === id) {
        reportLinkAddError('Этот пункт уже выбран');
        radioPickValue.value = null;
        return;
      }
    }
  }

  removeError.value = '';
  clearLinkAddError();
  try {
    await createLinkedDocument({ [field]: id });
  } catch {
    // ошибка уже передана через reportLinkAddError
  } finally {
    addMenuOpen.value = false;
    search.value = '';
    radioPickValue.value = null;
    if (addPlacementResolved.value !== 'inline') {
      addExpanded.value = false;
    }
  }
}

async function onRadioPickDocument(val) {
  radioPickValue.value = val;
  await runPickCreatesDocumentAdd(val);
}

function getEntityBucket() {
  const name = entityStoreCollection.value;
  if (!globalStore.store[name]) globalStore.store[name] = {};
  return globalStore.store[name];
}

function appendSelectedKeysToItems(items) {
  const vk = flat.value.itemValue;
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

  if (!search || search.length < 3) {
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
    await syncRemoteSearchOptions((value || '').trim());
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
    clearLinkAddError();
    if (pendingCreateResolve) {
      pendingCreateResolve.resolve(createdId);
      pendingCreateResolve = null;
    }
    emit('linkAdded', { targetId: createdId, created: true });
    emit('createNew', { _id: createdId });
  },
  { deep: true },
);

onMounted(() => {
  if (addPlacementResolved.value === 'inline') {
    addExpanded.value = true;
  }
  if (effectiveRemoteSearch.value) syncRemoteSearchOptions('');
});

watch(
  () => flat.value.contextKey,
  () => {
    pendingCreateFromStore.value = false;
    if (pendingCreateResolve) {
      pendingCreateResolve.reject(new Error('Сброс контекста'));
      pendingCreateResolve = null;
    }
    removeError.value = '';
    clearLinkAddError();
    addPickerValue.value = null;
    radioPickValue.value = null;
    addExpanded.value = addPlacementResolved.value === 'inline';
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

watch(isAddBlocked, (blocked) => {
  if (!blocked) return;
  addMenuOpen.value = false;
  addPickerValue.value = null;
  radioPickValue.value = null;
  if (addPlacementResolved.value !== 'inline') {
    addExpanded.value = false;
  }
});

function focusAddInput() {
  const refCmp = showSeparateCreateInput.value ? createInputRef.value : addFieldRef.value;
  if (refCmp && typeof refCmp.focus === 'function') {
    refCmp.focus();
    return;
  }
  const root = refCmp?.$el;
  const input = root?.querySelector?.('input:not([type=hidden])');
  input?.focus();
}

async function openAddField() {
  clearLinkAddError();
  if (
    flat.value.separateCreateButton &&
    resolvedAddType.value === 'button' &&
    addPlacementResolved.value === 'collapsed' &&
    linkPersistEnabled.value &&
    !flat.value.disabled
  ) {
    if (addingKey.value !== null || removingKey.value !== null) return;
    if (isAddBlocked.value) {
      reportLinkAddError(resolvedMaxSelectionMessage.value);
      return;
    }
    try {
      await createLinkedDocument({});
    } catch {
      // ошибка уже в reportLinkAddError
    }
    return;
  }
  addExpanded.value = true;
  addMenuOpen.value = false;
  nextTick(() => {
    nextTick(() => focusAddInput());
  });
}

function requestRemove(key, event) {
  removeConfirmKey.value = String(key);
  removeConfirmOpen.value = true;

  const el = event?.currentTarget;
  if (!el || typeof el.getBoundingClientRect !== 'function') return;
  const rect = el.getBoundingClientRect();
  // Tooltip-like блок ниже и по центру иконки.
  // Позиционируем tooltip слева от крестика: правый край tooltip = левый край кнопки.
  removeConfirmX.value = Math.round(rect.left) - 8;
  // Выровнять tooltip по верхней границе кнопки удаления.
  removeConfirmY.value = Math.max(8, Math.round(rect.top));
}

function cancelRemove() {
  removeConfirmOpen.value = false;
  removeConfirmKey.value = null;
}

async function confirmRemove() {
  const key = removeConfirmKey.value;
  cancelRemove();
  if (!key) return;
  await removeTarget(key);
}

function onDocMouseDown(e) {
  if (!removeConfirmOpen.value) return;
  const tooltipEl = removeConfirmEl.value;
  if (!tooltipEl || typeof tooltipEl.contains !== 'function') {
    cancelRemove();
    return;
  }
  if (e?.target && tooltipEl.contains(e.target)) return;
  cancelRemove();
}

watch(removeConfirmOpen, (open) => {
  if (open) {
    document.addEventListener('mousedown', onDocMouseDown, true);
    return;
  }
  document.removeEventListener('mousedown', onDocMouseDown, true);
});

watch(removeConfirmOpen, (open) => {
  if (!open) return;
  const onKey = (e) => {
    if (e.key === 'Escape') cancelRemove();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
});

function onAddSlotFocusOut(event) {
  if (addPlacementResolved.value === 'inline') return;
  const related = event.relatedTarget;
  if (related && typeof related === 'object' && event.currentTarget.contains(related)) return;
  window.setTimeout(() => {
    if (addMenuOpen.value) return;
    const root = event.currentTarget;
    if (
      root &&
      typeof root.contains === 'function' &&
      document.activeElement &&
      root.contains(document.activeElement)
    ) {
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
  const bucket = getEntityBucket();
  if (!bucket[k]) bucket[k] = { _id: k };
  return bucket[k];
}

async function createLinkedDocument(document = {}) {
  if (!linkPersistEnabled.value) {
    emit('createNew');
    const msg = 'Не настроено сохранение связей';
    reportLinkAddError(msg);
    throw new Error(msg);
  }

  if (isAddBlocked.value) {
    const msg = resolvedMaxSelectionMessage.value;
    reportLinkAddError(msg);
    throw new Error(msg);
  }

  const payload = document && typeof document === 'object' && !Array.isArray(document) ? { ...document } : {};
  removeError.value = '';
  clearLinkAddError();
  addingKey.value = ADD_CREATE_NEW_VALUE;

  const createdIdPromise = new Promise((resolve, reject) => {
    pendingCreateResolve = { resolve, reject };
  });

  try {
    pendingCreateFromStore.value = true;
    await callAddObject({
      collection: flat.value.collection,
      document: payload,
      link: {
        collection: linkParentCollection.value,
        _id: linkParentId.value,
        linkField: flat.value.linkField,
        linkPayload: {},
      },
    });
    const createdId = await createdIdPromise;
    clearLinkAddError();
    return createdId;
  } catch (error) {
    pendingCreateFromStore.value = false;
    if (pendingCreateResolve) {
      pendingCreateResolve.reject(error);
      pendingCreateResolve = null;
    }
    reportLinkAddError(error);
    throw error;
  } finally {
    addingKey.value = null;
  }
}

async function runCreateNew() {
  if (!flat.value.showCreateNewOption) return;
  if (addingKey.value !== null) return;
  if (isAddBlocked.value) {
    reportLinkAddError(resolvedMaxSelectionMessage.value);
    return;
  }
  if (!linkPersistEnabled.value) {
    emit('createNew');
    if (addPlacementResolved.value !== 'inline') {
      addExpanded.value = false;
    }
    addMenuOpen.value = false;
    search.value = '';
    return;
  }

  const createField = String(flat.value.createField || 'title').trim() || 'title';
  const createValue = String(search.value || '').trim();
  let document;
  if (!createValue) {
    if (resolvedAddType.value === 'button') {
      document = {};
    } else {
      return;
    }
  } else {
    document = { [createField]: createValue };
  }

  clearLinkAddError();
  try {
    await createLinkedDocument(document);
  } catch {
    // ошибка уже передана через reportLinkAddError
  } finally {
    addMenuOpen.value = false;
    search.value = '';
    if (addPlacementResolved.value !== 'inline') {
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
    await runCreateNew();
    return;
  }
  if (!linkPersistEnabled.value) return;

  if (isAddBlocked.value) {
    addPickerValue.value = null;
    reportLinkAddError(resolvedMaxSelectionMessage.value);
    return;
  }

  if (flat.value.pickCreatesDocument) {
    addPickerValue.value = null;
    await runPickCreatesDocumentAdd(id);
    return;
  }

  if (selectedKeys.value.some((k) => String(k) === id)) {
    addPickerValue.value = null;
    return;
  }

  removeError.value = '';
  clearLinkAddError();
  addingKey.value = id;
  try {
    const _id = linkParentId.value;
    const collection = linkParentCollection.value;
    await callUpdateLink({
      _id,
      collection,
      linkField: flat.value.linkField,
      targetId: id,
      action: 'add',
      linkPayload: {},
      taskType: collection === 'task' ? globalStore.store[collection][_id].taskType : null,
    });
    clearLinkAddError();
    emit('linkAdded', { targetId: id });
  } catch (error) {
    reportLinkAddError(error);
  } finally {
    addingKey.value = null;
    addPickerValue.value = null;
    addMenuOpen.value = false;
    search.value = '';
    if (addPlacementResolved.value !== 'inline') {
      addExpanded.value = false;
    }
  }
}

async function removeTarget(key) {
  if (!linkPersistEnabled.value || removingKey.value !== null) return;
  const targetId = String(key);
  if (flat.value.minSelection > 0 && selectedKeys.value.length - 1 < flat.value.minSelection) {
    removeError.value = `Нужно оставить не меньше ${flat.value.minSelection}`;
    emit('linkRemoveError', removeError.value);
    return;
  }

  removeError.value = '';
  removingKey.value = targetId;
  try {
    const collection = linkParentCollection.value;
    const _id = linkParentId.value;
    await callUpdateLink({
      _id,
      collection,
      linkField: flat.value.linkField,
      targetId,
      action: 'remove',
      taskType: collection === 'task' ? globalStore.store[collection][_id].taskType : null,
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

function onNonLinkSelectionUpdate(next) {
  const max = maxSelectionEffective.value;
  const arr = Array.isArray(next) ? next.map((k) => String(k)) : [];
  if (max != null && arr.length > max) {
    selectedKeys.value = arr.slice(0, max);
    reportLinkAddError(resolvedMaxSelectionMessage.value);
    return;
  }
  selectedKeys.value = arr;
}
</script>

<style scoped>
.multi-entity-picker {
  margin-top: 10px;
  margin-bottom: 10px;
}

.multi-entity-picker__label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 4px 4px 12px;
  border-radius: 6px;
  color: rgb(var(--v-theme-on-surface));
  max-width: 100%;
  word-break: break-word;
  user-select: none;
}

.multi-entity-picker__label--full-width {
  display: flex;
  align-items: flex-start;
  flex: 1 1 100%;
  width: 100%;
  box-sizing: border-box;
}

.multi-entity-picker__label-text {
  min-width: 0;
}

.multi-entity-picker__label-text--full-width {
  flex: 1 1 100%;
  width: 100%;
  min-width: 100%;
  align-self: stretch;
}

.multi-entity-picker__label-text--full-width :deep(.app-input-wrap),
.multi-entity-picker__label-text--full-width :deep(.app-input-file-wrap),
.multi-entity-picker__label-text--full-width :deep(.app-select-wrap) {
  width: 100%;
  user-select: auto;
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

.multi-entity-picker__add-slot--radio-pick {
  flex: 1 1 100%;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  align-self: stretch;
}

.multi-entity-picker__radio-pick {
  width: 100%;
}

.multi-entity-picker__radio-group :deep(.v-label) {
  white-space: normal;
  line-height: 1.35;
}

.multi-entity-picker__add-slot--create-only {
  flex: 0 0 auto;
  min-width: 0;
  max-width: none;
  width: 100%;
}

.multi-entity-picker__add-slot--file-add {
  flex: 1 1 100%;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  align-self: stretch;
}

.multi-entity-picker__add-slot--create-only.multi-entity-picker__add-slot--file-add {
  flex: 1 1 100%;
  width: 100%;
}

.multi-entity-picker__add-slot--file-add :deep(.app-input-file-wrap),
.multi-entity-picker__add-slot--file-add :deep(.app-input-wrap) {
  width: 100%;
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

.multi-entity-picker__remove-confirm-tooltip {
  position: fixed;
  z-index: 3000;
  transform: translateX(-100%);
  max-width: min(360px, 90vw);
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border-radius: 8px;
  padding: 10px 12px 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.multi-entity-picker__remove-confirm-text {
  margin-bottom: 10px;
}
.multi-entity-picker__remove-confirm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
