<template>
  <div
    class="multi-entity-picker__add multi-entity-picker__radio-pick d-flex flex-column ga-2 align-self-stretch"
    :data-dev-id="devAnchorId"
    :class="{
      'app-radio-wrap--success': showSuccessOutline,
      'app-radio-wrap--error': showErrorOutline,
    }"
  >
    <div v-if="showFieldLabel" class="text-body-2 text-medium-emphasis">
      {{ fieldLabel }}
    </div>
    <v-radio-group
      :model-value="displayPickId"
      density="compact"
      hide-details="auto"
      class="multi-entity-picker__radio-group"
      :disabled="fieldDisabled || saving"
      :error="!!saveError"
      :error-messages="saveError ? [saveError] : []"
      :hint="saveError ? '' : hint"
      :persistent-hint="!saveError && !!String(hint || '').trim()"
      @update:model-value="handleUpdate"
    >
      <v-radio
        v-for="(item, idx) in resolvedItems"
        :key="`pick-radio-${idx}-${rowValue(item)}`"
        :label="rowTitle(item)"
        :value="rowValue(item)"
      />
    </v-radio-group>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useTaskFieldDisabled } from '../composables/useTaskFieldDisabled.js';
import { useDevAnchorId } from '../utils/devAnchorId.js';
import { saveField } from '../utils/storeActions.js';
import { useStore } from '../stores/store.js';

defineOptions({ inheritAttrs: false });

const OUTLINE_FLASH_MS = 2000;

const globalStore = useStore();

const props = defineProps({
  /** Сырое значение поля (как в БД / сторе) */
  modelValue: { type: [String, Number, Boolean], default: null },
  fieldLabel: { type: String, default: '' },
  /** Явный список пунктов; если пусто — берётся `globalStore.lst[lstName]` */
  items: { type: Array, default: () => [] },
  /** Ключ справочника в `store.lst` (например имя файла в `domain/lst` без `.js`) */
  lstName: { type: String, default: '' },
  itemTitle: { type: String, default: 'title' },
  itemValue: { type: String, default: 'code' },
  disabled: { type: Boolean, default: false },
  accessPath: { type: String, default: '' },
  hint: { type: String, default: '' },
  collection: { type: String, default: '' },
  _id: { type: String, default: '' },
  field: { type: String, default: '' },
  devId: { type: String, default: '' },
  contextKey: { type: String, default: '' },
  /** Значение в хранилище, эквивалентное «пустому» (часто `''`) */
  emptyStoredValue: { type: String, default: '' },
  /**
   * Значение пункта списка (`itemValue`), при выборе которого в поле пишется `emptyStoredValue`
   * (и наоборот: при `modelValue === emptyStoredValue` в группе показывается этот пункт).
   */
  pickStoredAsEmpty: { type: String, default: '' },
});

const devAnchorId = useDevAnchorId(props);
const fieldDisabled = useTaskFieldDisabled(props);

const emit = defineEmits(['update:modelValue']);

const saving = ref(false);
const saveError = ref('');
const lastCommitted = ref('');

const showSuccessOutline = ref(false);
const showErrorOutline = ref(false);
let successOutlineTimer = null;
let errorOutlineTimer = null;

const persistEnabled = computed(() => {
  const c = String(props.collection || '').trim();
  const id = String(props._id || '').trim();
  const f = String(props.field || '').trim();
  return Boolean(c && id && f);
});

const showFieldLabel = computed(() => String(props.fieldLabel || '').trim() !== '');

const resolvedItems = computed(() => {
  const direct = props.items;
  if (Array.isArray(direct) && direct.length > 0) return direct;
  const key = String(props.lstName || '').trim();
  if (!key) return [];
  const raw = globalStore.lst[key];
  return Array.isArray(raw) ? raw : [];
});

const pickIdSet = computed(() => new Set(resolvedItems.value.map((it) => rowValue(it))));

function rowValue(item) {
  if (!item || typeof item !== 'object') return '';
  const vk = props.itemValue;
  const raw = item.raw !== undefined ? item.raw : item;
  const r = raw && typeof raw === 'object' ? raw : item;
  return String(r[vk] ?? r._id ?? '').trim();
}

function rowTitle(item) {
  if (!item || typeof item !== 'object') return '';
  const tk = props.itemTitle;
  const raw = item.raw !== undefined ? item.raw : item;
  const r = raw && typeof raw === 'object' ? raw : item;
  const t = r[tk];
  if (t != null && String(t).trim() !== '') return String(t);
  const v = rowValue(item);
  return v || String(item);
}

function firstPickId() {
  const it = resolvedItems.value[0];
  return it ? rowValue(it) : '';
}

/** Какой пункт списка подсвечивать при текущем `modelValue` */
function rawToPickId(raw) {
  const s = raw != null ? String(raw).trim() : '';
  const emptyStored = String(props.emptyStoredValue ?? '');
  const mapPick = String(props.pickStoredAsEmpty || '').trim();
  const ids = pickIdSet.value;

  if (mapPick !== '' && (s === emptyStored || (emptyStored === '' && s === ''))) {
    return mapPick;
  }
  if (ids.has(s)) return s;
  if (mapPick !== '' && ids.has(mapPick)) return mapPick;
  return firstPickId() || '';
}

const displayPickId = computed(() => rawToPickId(props.modelValue));

function valueForPersistence(choice) {
  const raw = choice != null && choice !== '' ? String(choice) : '';
  const mapPick = String(props.pickStoredAsEmpty || '').trim();
  const emptyStored = props.emptyStoredValue === undefined ? '' : String(props.emptyStoredValue);
  if (mapPick !== '' && raw === mapPick) return emptyStored;
  return raw;
}

function storedFromModel(raw) {
  return valueForPersistence(rawToPickId(raw));
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

onUnmounted(() => {
  clearOutlineFlash();
});

async function handleUpdate(val) {
  if (!persistEnabled.value) {
    emit('update:modelValue', val);
    return;
  }

  if (fieldDisabled.value || saving.value) return;

  const toSave = valueForPersistence(val);
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
      data: { [String(props.field).trim()]: toSave },
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
</script>

<style scoped>
.app-radio-wrap--success {
  outline: 2px solid rgb(var(--v-theme-success));
  outline-offset: 2px;
  border-radius: 4px;
}

.app-radio-wrap--error {
  outline: 2px solid rgb(var(--v-theme-error));
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
