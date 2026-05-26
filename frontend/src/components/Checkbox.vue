<template>
  <div
    class="app-checkbox-wrap"
    :data-dev-id="devAnchorId"
    :class="{
      'app-checkbox-wrap--success': showSuccessOutline,
      'app-checkbox-wrap--error': showErrorOutline,
    }"
  >
    <v-checkbox
      v-model="checked"
      v-bind="$attrs"
      :label="label"
      density="comfortable"
      hide-details="auto"
      :disabled="fieldDisabled || saving"
      :loading="loading || saving"
      :hint="saveError ? '' : hint"
      :persistent-hint="!saveError && !!String(hint || '').trim()"
      :error="!!saveError"
      :error-messages="saveError ? [saveError] : []"
      @update:model-value="onCheckedUpdate"
    />
  </div>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue';
import { useResolvedTaskLinkRpc } from '../composables/taskLinkContext.js';
import { useTaskFieldDisabled } from '../composables/useTaskFieldDisabled.js';
import { useDevAnchorId } from '../utils/devAnchorId.js';
import { saveField } from '../utils/storeActions.js';

defineOptions({ inheritAttrs: false });

const OUTLINE_FLASH_MS = 2000;

const checked = defineModel({ type: Boolean, default: false });

const props = defineProps({
  /** Идентификатор документа (не нужен при ephemeral) */
  _id: { type: String, default: '' },
  /** Коллекция MongoDB (не нужна при ephemeral) */
  collection: { type: String, default: '' },
  /** Имя поля для $set (не нужно при ephemeral) */
  field: { type: String, default: '' },
  devId: { type: String, default: '' },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  /** Смена ключа сбрасывает подсветку, ошибку и базовое значение для пропуска лишних запросов */
  contextKey: { type: String, default: '' },
  /** Родитель обрабатывает переключение: без saveField, событие `commit` */
  ephemeral: { type: Boolean, default: false },
  /** Внешний индикатор загрузки */
  loading: { type: Boolean, default: false },
  taskType: { type: String, default: '' },
  schemaPath: { type: [String, Array], default: () => [] },
  linkField: { type: String, default: '' },
  accessPath: { type: String, default: '' },
});

const devAnchorId = useDevAnchorId(props);
const fieldDisabled = useTaskFieldDisabled(props);
const { schemaPath: linkSchemaPath, taskType: linkTaskType, linkField: linkFieldName } =
  useResolvedTaskLinkRpc(props);

const emit = defineEmits(['commit']);

const saving = ref(false);
const saveError = ref('');
const lastCommitted = ref(false);

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
    lastCommitted.value = Boolean(checked.value);
    saveError.value = '';
    clearOutlineFlash();
  },
  { immediate: true },
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

  const next = Boolean(checked.value);
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
    const schemaPath = linkSchemaPath.value;
    await saveField({
      collection,
      _id,
      data: { [field]: next },
      taskType: linkTaskType.value || undefined,
      schemaPath: schemaPath.length > 0 ? schemaPath : undefined,
      linkField: linkFieldName.value || undefined,
    });
    lastCommitted.value = next;
    flashSuccess();
  } catch (error) {
    saveError.value = error.message || 'Не удалось сохранить';
    flashError();
  } finally {
    saving.value = false;
  }
}

function onCheckedUpdate() {
  void persist();
}
</script>

<style scoped>
.app-checkbox-wrap {
  display: inline-flex;
  max-width: 100%;
  border-radius: 4px;
  transition: outline-color 0.15s ease, box-shadow 0.15s ease;
}

.app-checkbox-wrap--success {
  outline: 2px solid rgb(var(--v-theme-success));
  outline-offset: 2px;
}

.app-checkbox-wrap--error {
  outline: 2px solid rgb(var(--v-theme-error));
  outline-offset: 2px;
}
</style>
