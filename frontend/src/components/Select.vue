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
      :loading="loading || saving"
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
import { computed, onUnmounted, ref, watch } from 'vue';
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

const resolvedItems = computed(() => {
  const vk = props.itemValue;
  const tk = props.itemTitle;
  let items = [];
  const direct = props.items;
  if (Array.isArray(direct) && direct.length > 0) {
    items = direct;
  } else {
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
    return;
  }
  if (!open) syncSearchInputFromModel();
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
      field: String(props.field).trim(),
      value: toSave,
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
