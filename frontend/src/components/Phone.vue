<template>
  <div class="app-phone" :class="{ 'app-phone--disabled': phoneDisabled }">
    <div
      class="app-phone__row d-flex align-stretch"
      :class="{
        'app-phone__row--success': showSuccessOutline,
        'app-phone__row--error': showErrorOutline,
      }"
    >
      <div class="app-phone__code-col">
        <InputInline
          :model-value="code"
          class="app-phone__code"
          :collection="collection"
          :_id="_id"
          field="code"
          :field-label="codeLabel"
          reserve-label-space
          suppress-outline
          empty-label="+7"
          :required="false"
          :disabled="phoneDisabled"
          :context-key="`${contextKey}:code`"
          :format-display="formatCode"
          :parse-value="parseCode"
          edit-variant="underlined"
          edit-density="default"
          display-class="app-phone__code-display"
          @update:model-value="code = $event"
          @save-success="flashSuccess"
          @save-error="flashError"
        />
      </div>
      <Input
        v-model="number"
        class="app-phone__number"
        :collection="collection"
        :_id="_id"
        field="number"
        :label="label"
        :disabled="phoneDisabled"
        :loading="loading"
        :hint="hint"
        suppress-outline
        :context-key="`${contextKey}:number`"
        :format-display="formatNational"
        :parse-value="parseNational"
        inputmode="tel"
        autocomplete="tel"
        placeholder="(___) ___-__-__"
        v-bind="inputAttrs"
        @save-success="flashSuccess"
        @save-error="flashError"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onUnmounted, ref, useAttrs, watch } from 'vue';
import Input from './Input.vue';
import InputInline from './InputInline.vue';
import { TASK_FIELD_ACCESS_KEY } from '../composables/taskFieldAccessContext.js';
import { isTaskFieldDisabled } from '../utils/taskFieldAccess.js';
import { formatCode, formatNational, parseCode, parseNational } from '../utils/phoneFormat.js';

defineOptions({ inheritAttrs: false });

const OUTLINE_FLASH_MS = 2000;

const code = defineModel('code', { type: String, default: '' });
const number = defineModel('number', { type: String, default: '' });

const props = defineProps({
  _id: { type: String, default: '' },
  collection: { type: String, default: '' },
  /** Подпись поля номера */
  label: { type: String, default: '' },
  /** Подпись поля кода (может быть пустой — место под label сохраняется) */
  codeLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  contextKey: { type: String, default: '' },
  loading: { type: Boolean, default: false },
});

const taskFieldAccess = inject(TASK_FIELD_ACCESS_KEY, null);

const phoneDisabled = computed(() => {
  if (props.disabled) return true;
  if (!taskFieldAccess?.path) return false;
  return (
    isTaskFieldDisabled(taskFieldAccess.path('code')) ||
    isTaskFieldDisabled(taskFieldAccess.path('number'))
  );
});

const attrs = useAttrs();
const inputAttrs = computed(() => {
  const { class: _c, ...rest } = attrs;
  return rest;
});

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
    clearOutlineFlash();
  },
);

onUnmounted(() => {
  clearOutlineFlash();
});
</script>

<style scoped>
.app-phone {
  width: 100%;
}

.app-phone__row {
  gap: 0;
  width: 100%;
  border-radius: 4px;
  transition: outline-color 0.15s ease;
}

.app-phone__row--success {
  outline: 2px solid rgb(var(--v-theme-success));
  outline-offset: 2px;
}

.app-phone__row--error {
  outline: 2px solid rgb(var(--v-theme-error));
  outline-offset: 2px;
}

.app-phone__code-col {
  flex: 0 0 auto;
  min-width: 3.25rem;
  max-width: 5.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-self: stretch;
  padding-right: 4px;
}

.app-phone__code {
  flex: 0 0 auto;
  margin-top: auto;
}

.app-phone__number {
  flex: 1 1 auto;
  min-width: 0;
}

.app-phone__code :deep(.inline-edit-text) {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  flex: 1 1 auto;
}

.app-phone__code :deep(.app-phone__code-display) {
  margin: 0;
  padding: 0 2px 4px;
  min-height: 24px;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  text-align: center;
  font-size: 1rem;
  line-height: 1.5;
  border-radius: 0;
}

.app-phone__code :deep(.inline-edit-text__display:hover) {
  background-color: transparent;
}

.app-phone__code :deep(.inline-edit-text__field) {
  margin-bottom: 0 !important;
  padding-top: 0;
}

.app-phone__code :deep(.inline-edit-text__field input) {
  text-align: center;
}

.app-phone__code :deep(.inline-edit-text__error) {
  position: absolute;
  left: 0;
  bottom: -18px;
  white-space: nowrap;
  padding-inline-start: 0;
}

.app-phone__number :deep(.app-input-wrap) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.app-phone__number :deep(.v-input) {
  flex: 1 1 auto;
}

.app-phone--disabled {
  opacity: var(--v-disabled-opacity, 0.38);
  pointer-events: none;
}
</style>
