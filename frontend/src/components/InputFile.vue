<template>
  <div
    class="app-input-file-wrap"
    :class="{
      'app-input-file-wrap--success': showSuccessOutline,
      'app-input-file-wrap--error': showErrorOutline,
      'app-input-file-wrap--dragover': isDragOver,
    }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDropFile"
  >
    <input
      ref="fileInputRef"
      type="file"
      class="d-none"
      :accept="accept"
      :disabled="disabled || saving"
      @change="onNativeFileChange"
    />
    <v-text-field
      v-bind="$attrs"
      :model-value="displayValue"
      readonly
      variant="outlined"
      :label="label"
      :hint="saveError ? '' : hint"
      :persistent-hint="!saveError"
      :error="!!saveError"
      :error-messages="saveError ? [saveError] : []"
      :disabled="disabled || saving"
      :loading="saving"
    >
      <template #prepend-inner>
        <v-btn
          type="button"
          icon="mdi-upload"
          variant="text"
          density="comfortable"
          :disabled="disabled || saving"
          :aria-label="uploadAriaLabel"
          @click="openFilePicker"
        />
      </template>
      <template v-if="hasStoredFile" #append-inner>
        <v-btn
          type="button"
          icon="mdi-close"
          variant="text"
          density="comfortable"
          :disabled="disabled || saving || downloading"
          aria-label="Очистить файл"
          @click="clearStoredFile"
        />
        <v-btn
          type="button"
          icon="mdi-download"
          variant="text"
          density="comfortable"
          :disabled="disabled || saving || downloading"
          :loading="downloading"
          :aria-label="downloadAriaLabel"
          @click="downloadStoredFile"
        />
      </template>
    </v-text-field>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { getBackendState } from '../api/backend.js';
import { saveField } from '../utils/storeActions.js';

defineOptions({ inheritAttrs: false });

const OUTLINE_FLASH_MS = 2000;

const fileName = defineModel({ type: String, default: '' });

const props = defineProps({
  /** Идентификатор документа */
  _id: { type: String, required: true },
  /** Коллекция MongoDB (как в core/updateField) */
  collection: { type: String, required: true },
  /** Имя поля — в БД хранится имя файла на сервере (`application/resources/<name>`) */
  field: { type: String, required: true },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  hint: {
    type: String,
    default: 'Загрузите файл — на сервер сохраняется поток, в поле записывается имя файла',
  },
  /** Атрибут accept у скрытого input[type=file] */
  accept: { type: String, default: '' },
  /** MIME для `Blob` при скачивании (как в `console.js` / api.files.download) */
  downloadMimeType: { type: String, default: 'application/octet-stream' },
  uploadAriaLabel: { type: String, default: 'Загрузить файл' },
  downloadAriaLabel: { type: String, default: 'Скачать файл' },
  emptyPlaceholder: { type: String, default: 'Файл не выбран' },
  /** Смена ключа сбрасывает подсветку, ошибку и базовое значение */
  contextKey: { type: String, default: '' },
});

const fileInputRef = ref(null);
const saving = ref(false);
const downloading = ref(false);
const isDragOver = ref(false);
const saveError = ref('');
const lastCommitted = ref('');

const showSuccessOutline = ref(false);
const showErrorOutline = ref(false);
let successOutlineTimer = null;
let errorOutlineTimer = null;

const hasStoredFile = computed(() => String(fileName.value || '').trim() !== '');

const displayValue = computed(() =>
  hasStoredFile.value ? String(fileName.value).trim() : props.emptyPlaceholder,
);

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
    lastCommitted.value = String(fileName.value).trim();
    saveError.value = '';
    clearOutlineFlash();
  },
  { immediate: true },
);

onUnmounted(() => {
  clearOutlineFlash();
});

function openFilePicker() {
  if (props.disabled || saving.value) return;
  fileInputRef.value?.click();
}

function canHandleDrop() {
  return !props.disabled && !saving.value;
}

function onDragEnter(event) {
  if (!canHandleDrop()) return;
  const hasFiles = event.dataTransfer?.types?.includes?.('Files');
  if (hasFiles) isDragOver.value = true;
}

function onDragOver(event) {
  if (!canHandleDrop()) return;
  const hasFiles = event.dataTransfer?.types?.includes?.('Files');
  if (!hasFiles) return;
  isDragOver.value = true;
  event.dataTransfer.dropEffect = 'copy';
}

function onDragLeave(event) {
  const currentTarget = event.currentTarget;
  const relatedTarget = event.relatedTarget;
  if (currentTarget?.contains?.(relatedTarget)) return;
  isDragOver.value = false;
}

async function uploadAndPersistFile(file) {
  if (!file || props.disabled) return;
  if (!props._id) {
    saveError.value = 'Не указан идентификатор записи';
    flashError();
    return;
  }

  saving.value = true;
  saveError.value = '';
  try {
    await uploadBlobToServer(file);
    const next = String(file.name || '').trim();
    await saveField({
      collection: props.collection,
      _id: props._id,
      field: props.field,
      value: next,
    });
    fileName.value = next;
    lastCommitted.value = next;
    flashSuccess();
  } catch (error) {
    saveError.value = error.message || 'Не удалось загрузить или сохранить';
    flashError();
  } finally {
    saving.value = false;
  }
}

async function streamAfterDownload(streamId) {
  const metacom = getBackendState()?.metacom;
  if (!metacom) throw new Error('Нет соединения с сервером');
  for (let i = 0; i < 40; i++) {
    try {
      return metacom.getStream(streamId);
    } catch {
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  throw new Error('Поток загрузки файла не создан');
}

/** Как в `application/static/console.js`: api.files.upload + createBlobUploader */
async function uploadBlobToServer(file) {
  const backend = getBackendState();
  const upload = backend?.api?.files?.upload;
  if (!upload || !backend?.metacom?.createBlobUploader) {
    throw new Error('API files.upload недоступен');
  }
  const uploader = backend.metacom.createBlobUploader(file);
  await upload({ streamId: uploader.id, name: file.name });
  await uploader.upload();
}

/** Как в `console.js`: api.files.download + getStream + toBlob */
async function fetchFileBlob(storedName) {
  const api = getBackendState()?.api;
  const download = api?.files?.download;
  if (!download) {
    throw new Error('API files.download недоступен');
  }
  const { streamId } = await download({ name: storedName });
  const readable = await streamAfterDownload(streamId);
  return readable.toBlob(props.downloadMimeType);
}

function triggerBrowserDownload(blob, name) {
  const a = document.createElement('a');
  a.style.display = 'none';
  document.body.appendChild(a);
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

async function onNativeFileChange(event) {
  const input = event.target;
  const file = input?.files?.[0];
  if (input) input.value = '';
  await uploadAndPersistFile(file);
}

async function onDropFile(event) {
  isDragOver.value = false;
  if (!canHandleDrop()) return;
  const file = event.dataTransfer?.files?.[0];
  await uploadAndPersistFile(file);
}

async function clearStoredFile() {
  if (!hasStoredFile.value || props.disabled || saving.value || downloading.value) return;
  if (!props._id) {
    saveError.value = 'Не указан идентификатор записи';
    flashError();
    return;
  }

  saving.value = true;
  saveError.value = '';
  try {
    await saveField({
      collection: props.collection,
      _id: props._id,
      field: props.field,
      value: '',
    });
    fileName.value = '';
    lastCommitted.value = '';
    flashSuccess();
  } catch (error) {
    saveError.value = error.message || 'Не удалось очистить поле файла';
    flashError();
  } finally {
    saving.value = false;
  }
}

async function downloadStoredFile() {
  const name = String(fileName.value || '').trim();
  if (!name || props.disabled || saving.value) return;

  downloading.value = true;
  saveError.value = '';
  try {
    const blob = await fetchFileBlob(name);
    triggerBrowserDownload(blob, name);
  } catch (error) {
    saveError.value = error.message || 'Не удалось скачать файл';
    flashError();
  } finally {
    downloading.value = false;
  }
}
</script>

<style scoped>
.app-input-file-wrap--success :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgb(var(--v-theme-success)) !important;
  --v-field-border-opacity: 1 !important;
  transition: color 0.15s ease;
}

.app-input-file-wrap--error :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgb(var(--v-theme-error)) !important;
  --v-field-border-opacity: 1 !important;
  transition: color 0.15s ease;
}

.app-input-file-wrap--dragover :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgb(var(--v-theme-primary)) !important;
  --v-field-border-opacity: 1 !important;
}
</style>
