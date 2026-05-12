<template>
  <div
    class="app-input-file-wrap"
    :class="{
      'app-input-file-wrap--success': showSuccessOutline,
      'app-input-file-wrap--error': showErrorOutline,
    }"
  >
    <v-file-input
      v-bind="$attrs"
      :model-value="displayedFileModel"
      :label="label"
      :multiple="multiple"
      :accept="accept"
      hide-details="auto"
      :hint="saveError ? '' : uiHint"
      :persistent-hint="!saveError && !!uiHint"
      :error="!!saveError"
      :error-messages="saveError ? [saveError] : []"
      :disabled="disabled || saving"
      :loading="saving"
      clearable
      prepend-icon="mdi-upload"
      @update:model-value="onFileInputUpdate"
    >
      <template v-if="hasStoredFile" #append-inner>
        <v-btn
          type="button"
          icon="mdi-download"
          variant="text"
          density="comfortable"
          :disabled="disabled || saving || downloading"
          :loading="downloading"
          :aria-label="downloadAriaLabel"
          @click.stop.prevent="downloadStoredFile"
          @mousedown.stop
          @pointerdown.stop
        />
      </template>
    </v-file-input>
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
  /** Идентификатор документа; при создании через связь можно не передавать */
  _id: { type: String, default: '' },
  /** Создание записи и связи перед первой загрузкой (слот `add` у ComplexBlock) */
  createLinkedDocument: { type: Function, default: null },
  /** Коллекция MongoDB (как в core/updateField) */
  collection: { type: String, required: true },
  /** Имя поля — в БД хранится имя файла на сервере (`application/resources/<name>`) */
  field: { type: String, required: true },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  /** Атрибут accept у v-file-input */
  accept: { type: String, default: '' },
  /** MIME для `Blob` при скачивании (как в `console.js` / api.files.download) */
  downloadMimeType: { type: String, default: 'application/octet-stream' },
  downloadAriaLabel: { type: String, default: 'Скачать файл' },
  emptyPlaceholder: { type: String, default: 'Файл не выбран' },
  /** Смена ключа сбрасывает подсветку, ошибку и базовое значение */
  contextKey: { type: String, default: '' },
  /** Несколько файлов за раз (для новых записей через `createLinkedDocument` — по файлу создаётся документ и загрузка) */
  multiple: { type: Boolean, default: false },
});

const pickedFile = ref(null);
const saving = ref(false);
const downloading = ref(false);
const saveError = ref('');
const lastCommitted = ref('');

const showSuccessOutline = ref(false);
const showErrorOutline = ref(false);
let successOutlineTimer = null;
let errorOutlineTimer = null;

const hasStoredFile = computed(() => String(fileName.value || '').trim() !== '');
const storedFileName = computed(() => String(fileName.value || '').trim());
const displayedFileModel = computed(() => {
  if (pickedFile.value) return pickedFile.value;
  if (!storedFileName.value) return null;
  // Псевдо-файл только для отображения имени в v-file-input.
  return { name: storedFileName.value };
});

const uiHint = computed(() => {
  return props.hint || '';
});

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
    pickedFile.value = null;
    lastCommitted.value = String(fileName.value).trim();
    saveError.value = '';
    clearOutlineFlash();
  },
  { immediate: true },
);

onUnmounted(() => {
  clearOutlineFlash();
});

async function resolveRecordId(file) {
  const recordId = String(props._id || '').trim();
  if (recordId) return recordId;
  if (typeof props.createLinkedDocument !== 'function') {
    throw new Error('Не указан идентификатор записи');
  }
  const title = String(file?.name || '').trim();
  const createdId = await props.createLinkedDocument({ title, fileName: '' });
  const nextId = String(createdId || '').trim();
  if (!nextId) {
    throw new Error('Не удалось создать запись для файла');
  }
  return nextId;
}

async function uploadOneFile(file) {
  const recordId = await resolveRecordId(file);
  await uploadBlobToServer(file);
  const next = String(file.name || '').trim();
  await saveField({
    collection: props.collection,
    _id: recordId,
    field: props.field,
    value: next,
  });
  fileName.value = next;
  lastCommitted.value = next;
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

async function onFileInputUpdate(value) {
  const raw = value == null ? [] : Array.isArray(value) ? value : [value];
  const files = raw.filter((f) => f instanceof File);
  if (files.length === 0) {
    if (hasStoredFile.value) await clearStoredFile();
    return;
  }

  const recordId = String(props._id || '').trim();
  const canBatch =
    props.multiple && !recordId && typeof props.createLinkedDocument === 'function';
  const queue = canBatch ? files : [files[0]];

  saving.value = true;
  saveError.value = '';
  pickedFile.value = null;
  try {
    for (const file of queue) {
      await uploadOneFile(file);
    }
    flashSuccess();
    if (canBatch) {
      fileName.value = '';
      lastCommitted.value = '';
    }
  } catch (error) {
    saveError.value = error.message || 'Не удалось загрузить или сохранить';
    flashError();
  } finally {
    pickedFile.value = null;
    saving.value = false;
  }
}

async function clearStoredFile() {
  if (!hasStoredFile.value || props.disabled || saving.value || downloading.value) return;
  const recordId = String(props._id || '').trim();
  if (!recordId) {
    pickedFile.value = null;
    return;
  }

  saving.value = true;
  saveError.value = '';
  try {
    await saveField({
      collection: props.collection,
      _id: recordId,
      field: props.field,
      value: '',
    });
    pickedFile.value = null;
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
</style>
