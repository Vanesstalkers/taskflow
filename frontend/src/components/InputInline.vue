<template>
  <div
    class="inline-edit-text align-self-stretch"
    :data-dev-id="devAnchorId"
    :class="{
      'inline-edit-text--success': showSuccessOutline,
      'inline-edit-text--error': showErrorOutline,
      'inline-edit-text--with-label': reserveLabelSpace,
    }"
  >
    <div v-if="reserveLabelSpace && !editing" class="inline-edit-text__static-label">
      {{ fieldLabelText }}
    </div>
    <v-text-field
      v-if="editing"
      ref="inputRef"
      v-model="draft"
      :label="fieldLabelDisplay"
      :density="editDensity"
      :variant="editVariant"
      hide-details="auto"
      class="inline-edit-text__field"
      :class="inputClass"
      :disabled="disabled || saving"
      :error="!!combinedError"
      :error-messages="combinedError ? [combinedError] : []"
      autofocus
      @blur="finishEdit"
      @keydown.enter.prevent="finishEdit"
      @keydown.esc.prevent="cancelEdit"
    />
    <component
      :is="displayTag"
      v-else
      class="inline-edit-text__display text-break"
      :class="[displayClass, { 'inline-edit-text__display--placeholder': isPlaceholderDisplay }]"
      tabindex="0"
      role="textbox"
      :title="hint"
      @click="startEdit"
      @focus="startEdit"
      @keydown.enter.prevent="startEdit"
      @keydown.space.prevent="startEdit"
    >
      {{ displayText }}
    </component>
    <div v-if="combinedError && !editing" class="inline-edit-text__error text-caption text-error" role="status">
      {{ combinedError }}
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useDevAnchorId } from '../utils/devAnchorId.js';
import { saveField } from '../utils/storeActions.js';

const OUTLINE_FLASH_MS = 2000;

const props = defineProps({
  /** Значение извне (источник истины в режиме просмотра) */
  modelValue: { type: String, default: '' },
  /** Подпись, если modelValue пустой */
  emptyLabel: { type: String, default: '—' },
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  displayTag: { type: String, default: 'span' },
  displayClass: { type: String, default: '' },
  inputClass: { type: String, default: '' },
  /** Идентификатор документа */
  _id: { type: String, required: true },
  /** Коллекция MongoDB (core/updateField) */
  collection: { type: String, required: true },
  /** Имя поля для $set */
  field: { type: String, required: true },
  devId: { type: String, default: '' },
  /**
   * Если true — пустая строка после trim считается ошибкой и не уходит на сервер.
   */
  required: { type: Boolean, default: true },
  /** Ошибка с родителя (кросс-полевая валидация и т.п.) */
  errorMessage: { type: String, default: '' },
  /** Смена ключа сбрасывает подсветку и внутренние ошибки сохранения */
  contextKey: { type: String, default: '' },
  formatDisplay: { type: Function, default: null },
  parseValue: { type: Function, default: null },
  /** Вариант поля в режиме редактирования (v-text-field) */
  editVariant: { type: String, default: 'outlined' },
  editDensity: { type: String, default: 'compact' },
  /** Подпись поля (пустая строка — зарезервировать место под v-label) */
  fieldLabel: { type: String, default: '' },
  /** Зарезервировать строку подписи (как у v-text-field label) */
  reserveLabelSpace: { type: Boolean, default: false },
  suppressOutline: { type: Boolean, default: false },
});

const fieldLabelText = computed(() => {
  const t = String(props.fieldLabel ?? '').trim();
  return t !== '' ? t : '\u00a0';
});

const fieldLabelDisplay = computed(() => fieldLabelText.value);

const devAnchorId = useDevAnchorId(props);

const emit = defineEmits(['saved', 'update:modelValue', 'save-success', 'save-error']);

const editing = ref(false);
const draft = ref('');
const inputRef = ref(null);
const saving = ref(false);
const saveErrorInternal = ref('');

const combinedError = computed(() => props.errorMessage || saveErrorInternal.value);

const showSuccessOutline = ref(false);
const showErrorOutline = ref(false);
let successOutlineTimer = null;
let errorOutlineTimer = null;

function clearAllOutlines() {
  clearTimeout(successOutlineTimer);
  clearTimeout(errorOutlineTimer);
  successOutlineTimer = null;
  errorOutlineTimer = null;
  showSuccessOutline.value = false;
  showErrorOutline.value = false;
}

function startSuccessOutline() {
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

function startErrorOutline() {
  if (props.suppressOutline) {
    emit('save-error', combinedError.value);
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

watch(
  () => props.contextKey,
  () => {
    clearAllOutlines();
    saveErrorInternal.value = '';
  },
);

onUnmounted(() => {
  clearAllOutlines();
});

function displayFromRaw(value) {
  return props.formatDisplay ? props.formatDisplay(value) : String(value ?? '');
}

function valueFromDisplay(value) {
  return props.parseValue ? props.parseValue(value) : String(value ?? '').trim();
}

const isPlaceholderDisplay = computed(() => String(props.modelValue ?? '').trim() === '');

const displayText = computed(() => {
  const formatted = displayFromRaw(props.modelValue);
  return formatted !== '' ? formatted : props.emptyLabel;
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editing.value) draft.value = displayFromRaw(value);
  },
);

const startEdit = async () => {
  if (props.disabled || saving.value || editing.value) return;
  saveErrorInternal.value = '';
  draft.value = displayText.value;
  editing.value = true;
  await nextTick();
  const field = inputRef.value;
  const input = field?.$el?.querySelector?.('input');
  if (input) {
    input.focus();
    input.select();
  } else {
    field?.focus?.();
  }
};

const cancelEdit = () => {
  editing.value = false;
};

const finishEdit = async () => {
  if (!editing.value || saving.value) return;
  const next = valueFromDisplay(draft.value);
  const prev = valueFromDisplay(displayFromRaw(props.modelValue));
  editing.value = false;
  if (next === prev) return;

  saveErrorInternal.value = '';
  if (!props._id) {
    saveErrorInternal.value = 'Не указан идентификатор записи';
    startErrorOutline();
    return;
  }

  if (props.required && !next) {
    saveErrorInternal.value = 'Значение не может быть пустым';
    startErrorOutline();
    return;
  }

  saving.value = true;
  try {
    const { collection, _id, field } = props;
    await saveField({ collection, _id, data: { [field]: next } });
    emit('update:modelValue', next);
    emit('saved', { value: next });
    startSuccessOutline();
  } catch (error) {
    saveErrorInternal.value = error.message || 'Не удалось сохранить';
    startErrorOutline();
  } finally {
    saving.value = false;
  }
};

defineExpose({ cancelEdit });
</script>

<style scoped>
.inline-edit-text--with-label {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
}

.inline-edit-text__static-label {
  flex: 0 0 auto;
  min-height: 16px;
  margin-bottom: 4px;
  font-size: 0.75rem;
  line-height: 1rem;
  letter-spacing: 0.0333333333em;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.inline-edit-text__display {
  cursor: pointer;
  margin: 0;
  align-self: stretch;
  border-radius: 4px;
  padding: 2px 4px;
  margin-left: -4px;
  outline: none;
  transition: outline 0.15s ease, outline-offset 0.15s ease;
}

.inline-edit-text__display--placeholder {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.inline-edit-text__display:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}

.inline-edit-text__field {
  margin-bottom: 0 !important;
  padding-top: 0;
}

.inline-edit-text__error {
  margin-top: 4px;
  padding-inline-start: 14px;
  min-height: 14px;
}

.inline-edit-text--success .inline-edit-text__display {
  outline: 2px solid rgb(var(--v-theme-success));
  outline-offset: 2px;
}

.inline-edit-text--error .inline-edit-text__display {
  outline: 2px solid rgb(var(--v-theme-error));
  outline-offset: 2px;
}

.inline-edit-text--success :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgb(var(--v-theme-success)) !important;
  --v-field-border-opacity: 1 !important;
  transition: color 0.15s ease;
}

.inline-edit-text--error :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgb(var(--v-theme-error)) !important;
  --v-field-border-opacity: 1 !important;
  transition: color 0.15s ease;
}
</style>
