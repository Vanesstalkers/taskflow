<template>
  <div class="multi-entity-picker">
    <div class="multi-entity-picker__labels d-flex flex-wrap ga-2 align-center mb-3">
      <span
        v-if="selectedKeys.length === 0"
        class="text-body-2 text-medium-emphasis align-self-center"
      >
        {{ emptyText }}
      </span>

      <div
        v-for="key in selectedKeys"
        :key="String(key)"
        class="multi-entity-picker__label text-body-2"
      >
        <span class="multi-entity-picker__label-text">{{ labelFor(key) }}</span>
        <v-btn
          v-if="linkPersistEnabled"
          type="button"
          icon="mdi-close"
          variant="text"
          density="comfortable"
          size="x-small"
          color="medium-emphasis"
          class="multi-entity-picker__remove"
          :disabled="removingKey !== null || addingKey !== null || isRemoveBlocked"
          :loading="removingKey === String(key)"
          :aria-label="`Удалить: ${labelFor(key)}`"
          @click.stop="removeTarget(key)"
        />
      </div>

      <v-btn
        v-if="linkPersistEnabled && !addExpanded"
        type="button"
        icon="mdi-plus"
        variant="text"
        density="compact"
        size="small"
        class="multi-entity-picker__add-trigger"
        :disabled="addingKey !== null || removingKey !== null"
        :loading="loading || addingKey !== null"
        aria-label="Добавить"
        @click="openAddField"
      />

      <div
        v-if="linkPersistEnabled && addExpanded"
        class="multi-entity-picker__add-slot"
      >
        <v-autocomplete
          ref="addFieldRef"
          :model-value="addPickerValue"
          v-model:search="search"
          v-model:menu="addMenuOpen"
          class="multi-entity-picker__add"
          variant="outlined"
          density="compact"
          single-line
          :items="items"
          :loading="loading || addingKey !== null"
          :error="error"
          :error-messages="errorMessages"
          :item-title="itemTitle"
          :item-value="itemValue"
          :label="addFieldLabel"
          :placeholder="addPlaceholder"
          no-filter
          clearable
          hide-details="auto"
          :disabled="addingKey !== null || removingKey !== null"
          @update:model-value="onAddSelected"
          @blur="onAddFieldBlur"
        />
      </div>
    </div>

    <p
      v-if="error && linkPersistEnabled && !addExpanded && errorMessages.length"
      class="text-caption text-error mb-2"
    >
      {{ errorMessages[0] }}
    </p>

    <p v-if="removeError" class="text-caption text-error mb-2">{{ removeError }}</p>

    <v-autocomplete
      v-if="!linkPersistEnabled"
      v-model="selectedKeys"
      v-model:search="search"
      variant="outlined"
      :items="items"
      :loading="loading"
      :error="error"
      :error-messages="errorMessages"
      :item-title="itemTitle"
      :item-value="itemValue"
      :label="pickerLabel"
      no-filter
      multiple
      clearable
      hide-details="auto"
    >
      <template #selection />
    </v-autocomplete>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { getBackendState } from '../api/backend.js';
import { updateLink as callUpdateLink } from '../api/saveField.js';

const selectedKeys = defineModel({ type: Array, default: () => [] });
const search = defineModel('search', { type: String, default: '' });

const props = defineProps({
  items: { type: Array, default: () => [] },
  itemTitle: { type: String, default: 'title' },
  itemValue: { type: String, default: 'value' },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  errorMessages: { type: Array, default: () => [] },
  emptyText: { type: String, default: 'Ничего не выбрано' },
  pickerLabel: { type: String, default: 'Выбрать из списка' },
  /** Подпись у встроенного поля добавления (режим link) */
  addFieldLabel: { type: String, default: '' },
  /** Плейсхолдер поиска (auth/users — от 3 символов) */
  addPlaceholder: { type: String, default: 'Минимум 3 символа для поиска' },
  linkCollection: { type: String, default: '' },
  linkDocumentId: { type: String, default: '' },
  linkMapField: { type: String, default: '' },
  minSelection: { type: Number, default: 0 },
  contextKey: { type: String, default: '' },
});

const emit = defineEmits(['linkRemoved', 'linkRemoveError', 'linkAdded', 'linkAddError']);

const removingKey = ref(null);
const addingKey = ref(null);
const removeError = ref('');
const addPickerValue = ref(null);
/** Поле добавления скрыто за кнопкой «+», пока пользователь её не нажмёт */
const addExpanded = ref(false);
const addMenuOpen = ref(false);
const addFieldRef = ref(null);

const linkPersistEnabled = computed(
  () =>
    Boolean(
      props.linkCollection?.trim() &&
        props.linkDocumentId?.trim() &&
        props.linkMapField?.trim(),
    ),
);

const isRemoveBlocked = computed(
  () => props.minSelection > 0 && selectedKeys.value.length <= props.minSelection,
);

watch(
  () => props.contextKey,
  () => {
    removeError.value = '';
    addPickerValue.value = null;
    addExpanded.value = false;
    addMenuOpen.value = false;
  },
);

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

function onAddFieldBlur() {
  window.setTimeout(() => {
    if (addMenuOpen.value) return;
    addExpanded.value = false;
    search.value = '';
  }, 200);
}

function getEntryTitle(item) {
  if (item == null || typeof item !== 'object') return '';
  const raw = item[props.itemTitle];
  return raw != null ? String(raw) : '';
}

function getEntryValue(item) {
  if (item == null || typeof item !== 'object') return null;
  return item[props.itemValue];
}

const labelByKey = computed(() => {
  const map = new Map();
  for (const item of props.items) {
    const val = getEntryValue(item);
    if (val == null || val === '') continue;
    const k = String(val);
    map.set(k, getEntryTitle(item) || k);
  }
  return map;
});

function labelFor(key) {
  return labelByKey.value.get(String(key)) ?? String(key);
}

async function onAddSelected(val) {
  const raw = val;
  if (raw === null || raw === undefined || raw === '') {
    addPickerValue.value = null;
    return;
  }
  const id = String(raw);
  if (!linkPersistEnabled.value) return;
  if (selectedKeys.value.some((k) => String(k) === id)) {
    addPickerValue.value = null;
    return;
  }

  removeError.value = '';
  addingKey.value = id;
  try {
    const api = getBackendState()?.api;
    await callUpdateLink(api, {
      collection: props.linkCollection,
      id: props.linkDocumentId,
      linkField: props.linkMapField,
      targetId: id,
      action: 'add',
      linkPayload: {},
    });
    selectedKeys.value = [...selectedKeys.value, id];
    emit('linkAdded', { targetId: id });
  } catch (error) {
    emit('linkAddError', error.message || 'Не удалось добавить связь');
  } finally {
    addingKey.value = null;
    addPickerValue.value = null;
    addExpanded.value = false;
    addMenuOpen.value = false;
    search.value = '';
  }
}

async function removeTarget(key) {
  if (!linkPersistEnabled.value || removingKey.value !== null) return;
  const targetId = String(key);
  if (
    props.minSelection > 0 &&
    selectedKeys.value.length - 1 < props.minSelection
  ) {
    removeError.value = `Нужно оставить не меньше ${props.minSelection}`;
    emit('linkRemoveError', removeError.value);
    return;
  }

  removeError.value = '';
  removingKey.value = targetId;
  try {
    const api = getBackendState()?.api;
    await callUpdateLink(api, {
      collection: props.linkCollection,
      id: props.linkDocumentId,
      linkField: props.linkMapField,
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
