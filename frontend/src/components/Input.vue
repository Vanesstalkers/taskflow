<template>
  <div
    class="app-input-wrap"
    :data-dev-id="devAnchorId"
    :class="{
      'app-input-wrap--success': showSuccessOutline,
      'app-input-wrap--error': showErrorOutline,
    }"
  >
    <v-text-field
      v-model="text"
      v-bind="$attrs"
      :label="label"
      variant="underlined"
      hide-details="auto"
      :disabled="fieldDisabled || saving"
      :loading="loading || saving"
      :hint="saveError ? '' : hint"
      :persistent-hint="!saveError && !!String(hint || '').trim()"
      :error="!!saveError"
      :error-messages="saveError ? [saveError] : []"
      @keydown="onKeydown"
      @blur="onBlur"
    />
  </div>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue';
import { useFieldDisabled } from '../composables/useFieldDisabled.js';
import { useDevAnchorId } from '../utils/devAnchorId.js';
import { saveField } from '../utils/storeActions.js';

defineOptions({ inheritAttrs: false });

const OUTLINE_FLASH_MS = 2000;

const raw = defineModel({ type: String, default: '' });
const text = ref('');

const props = defineProps({
  /** Идентификатор документа (не нужен при ephemeral) */
  _id: { type: String, default: '' },
  /** Коллекция MongoDB (не нужна при ephemeral) */
  collection: { type: String, default: '' },
  /** Имя поля для $set (не нужно при ephemeral) */
  field: { type: String, default: '' },
  /** Полный devId из manifest; иначе `collection.field` */
  devId: { type: String, default: '' },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  /** Путь в store.taskSchema (getTask), например createdSubdivisionLinks.name */
  accessPath: { type: String, default: '' },
  hint: { type: String, default: '' },
  /** Смена ключа сбрасывает подсветку, ошибку и базовое значение для пропуска лишних запросов */
  contextKey: { type: String, default: '' },
  /** Родитель обрабатывает ввод (blur / Enter): без saveField, событие `commit` */
  ephemeral: { type: Boolean, default: false },
  /** Внешний индикатор загрузки (например создание связанного документа) */
  loading: { type: Boolean, default: false },
  /** Отображение в поле, на сервер уходит результат parseValue */
  formatDisplay: { type: Function, default: null },
  parseValue: { type: Function, default: null },
  /** Не подсвечивать обёртку — родитель (например Phone) показывает outline */
  suppressOutline: { type: Boolean, default: false },
});

const devAnchorId = useDevAnchorId(props);
const fieldDisabled = useFieldDisabled(props);

const emit = defineEmits(['commit', 'save-success', 'save-error']);

const saving = ref(false);
const saveError = ref('');
const lastCommitted = ref('');

const showSuccessOutline = ref(false);
const showErrorOutline = ref(false);
let successOutlineTimer = null;
let errorOutlineTimer = null;

function clearOutlineFlash() {
  clearTimeout(successOutlineTimer);
  clearTimeout(errorOutlineTimer);
  successOutlineTimer = null;
  errorOutlineTimer = null;
  showSuccessOutline.value = false;
  showErrorOutline.value = false;
}

function flashSuccess() {
  if (props.suppressOutline) {
    emit('save-success');
    return;
  }
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
  if (props.suppressOutline) {
    emit('save-error', saveError.value);
    return;
  }
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

function displayFromRaw(value) {
  return props.formatDisplay ? props.formatDisplay(value) : String(value ?? '');
}

function valueFromDisplay(value) {
  return props.parseValue ? props.parseValue(value) : String(value ?? '').trim();
}

function syncTextFromRaw() {
  text.value = displayFromRaw(raw.value);
}

watch(
  () => props.contextKey,
  () => {
    syncTextFromRaw();
    lastCommitted.value = valueFromDisplay(text.value);
    saveError.value = '';
    clearOutlineFlash();
  },
  { immediate: true },
);

watch(text, (val) => {
  const parsed = valueFromDisplay(val);
  if (parsed !== String(raw.value ?? '')) raw.value = parsed;
  if (props.formatDisplay) {
    const formatted = displayFromRaw(parsed);
    if (formatted !== val) text.value = formatted;
  }
});

watch(
  () => raw.value,
  (v) => {
    if (valueFromDisplay(text.value) !== String(v ?? '')) syncTextFromRaw();
  },
);

onUnmounted(() => {
  clearOutlineFlash();
});

async function persist() {
  if (fieldDisabled.value || saving.value) return;

  if (props.ephemeral) {
    emit('commit');
    return;
  }

  const next = valueFromDisplay(text.value);
  if (next === lastCommitted.value) return;

  if (!props._id) {
    saveError.value = 'Не указан идентификатор записи';
    flashError();
    return;
  }

  saving.value = true;
  saveError.value = '';
  try {
    const { collection, _id, field } = props;
    await saveField({ collection, _id, data: { [field]: next } });
    raw.value = next;
    syncTextFromRaw();
    lastCommitted.value = next;
    flashSuccess();
  } catch (error) {
    saveError.value = error.message || 'Не удалось сохранить';
    flashError();
  } finally {
    saving.value = false;
  }
}

function onKeydown(event) {
  if (fieldDisabled.value || saving.value) return;
  if (props.ephemeral) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void persist();
    }
    return;
  }
  if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
  event.preventDefault();
  persist();
}

function onBlur() {
  if (fieldDisabled.value || saving.value) return;
  persist();
}
</script>

<style scoped>
.app-input-wrap {
  display: block;
  width: 100%;
  max-width: 100%;
  border-radius: 4px;
  transition: outline-color 0.15s ease;
}

.app-input-wrap--success {
  outline: 2px solid rgb(var(--v-theme-success));
  outline-offset: 2px;
}

.app-input-wrap--error {
  outline: 2px solid rgb(var(--v-theme-error));
  outline-offset: 2px;
}
</style>
