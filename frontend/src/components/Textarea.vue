<template>
  <div
    class="app-textarea-wrap"
    :class="{
      'app-textarea-wrap--success': showSuccessOutline,
      'app-textarea-wrap--error': showErrorOutline,
    }"
  >
    <v-textarea
      v-model="text"
      v-bind="$attrs"
      :label="label"
      variant="outlined"
      :rows="rows"
      :disabled="disabled || saving"
      hide-details="auto"
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
import { saveField } from '../utils/storeActions.js';

defineOptions({ inheritAttrs: false });

const OUTLINE_FLASH_MS = 2000;

const text = defineModel({ type: String, default: '' });

const props = defineProps({
  /** Идентификатор документа */
  _id: { type: String, required: true },
  /** Коллекция MongoDB (как в core/updateField) */
  collection: { type: String, required: true },
  /** Имя поля для $set */
  field: { type: String, required: true },
  label: { type: String, default: '' },
  rows: { type: [Number, String], default: 4 },
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  /** Смена ключа сбрасывает подсветку, ошибку и базовое значение для пропуска лишних запросов */
  contextKey: { type: String, default: '' },
});

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
    lastCommitted.value = String(text.value).trim();
    saveError.value = '';
    clearOutlineFlash();
  },
  { immediate: true },
);

onUnmounted(() => {
  clearOutlineFlash();
});

async function persist() {
  if (props.disabled || saving.value) return;
  const next = String(text.value).trim();
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
    await saveField({ collection, _id, field, value: next });
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
  if (props.disabled || saving.value) return;
  if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
  event.preventDefault();
  persist();
}

function onBlur() {
  if (props.disabled || saving.value) return;
  persist();
}
</script>

<style scoped>
.app-textarea-wrap--success :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgb(var(--v-theme-success)) !important;
  --v-field-border-opacity: 1 !important;
  transition: color 0.15s ease;
}

.app-textarea-wrap--error :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgb(var(--v-theme-error)) !important;
  --v-field-border-opacity: 1 !important;
  transition: color 0.15s ease;
}
</style>
