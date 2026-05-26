<template>
  <ComplexBlock
    v-if="parentId"
    :model-value="phoneListKeys"
    :list="{ lstName: 'phoneTypes' }"
    :persist="{
      collection: 'phone',
      parentCollection,
      parentId,
      linkField,
      taskType: resolvedTaskType,
      schemaPath: schemaPathArr,
      contextKey: parentId,
    }"
    :add="{
      addType: 'select',
      addPlacement: 'inline',
      pickCreatesDocument: true,
      pickDocumentField: 'phoneType',
      showCreateNewOption: false,
    }"
    :ui="{ fullWidthLabels: true, ...ui }"
    :texts="{
      blockTitle: 'Телефоны',
      emptyText: 'Телефоны не добавлены',
      addFieldLabel: 'Тип телефона',
      addPlaceholder: 'Выберите тип из списка',
      ...texts,
    }"
  >
    <template #label="{ _id: phoneId, record: phoneRecord = {} }">
      <div class="d-flex flex-column ga-2 align-self-stretch w-100">
        <Select
          :model-value="phoneRecord.phoneType || ''"
          lst-name="phoneTypes"
          label="Тип"
          density="comfortable"
          :single-line="false"
          collection="phone"
          :_id="phoneId"
          field="phoneType"
          :context-key="`${phoneId}:phoneType`"
        />
        <PhoneNumber
          v-model:code="phoneRecord.code"
          v-model:number="phoneRecord.number"
          collection="phone"
          :_id="phoneId"
          label="Номер"
          :context-key="phoneId"
        />
        <Checkbox
          v-if="showActive"
          :model-value="Boolean(phoneRecord?.active)"
          label="Активный"
          :_id="phoneId"
          collection="phone"
          field="active"
          :context-key="`${phoneId}:active`"
        />
      </div>
    </template>
  </ComplexBlock>
</template>

<script setup>
import { computed, inject } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import PhoneNumber from '../Phone.vue';
import Select from '../Select.vue';
import Checkbox from '../Checkbox.vue';
import { provideTaskFieldAccess } from '../../composables/taskFieldAccessContext.js';
import {
  normalizeSchemaPath,
  provideTaskLinkContext,
  TASK_LINK_CONTEXT_KEY,
} from '../../composables/taskLinkContext.js';
import { useStore } from '../../stores/store.js';

const props = defineProps({
  parentId: { type: String, required: true },
  parentCollection: { type: String, required: true },
  linkField: { type: String, default: 'phoneList' },
  /** Переопределение при вызове вне provide */
  taskType: { type: String, default: '' },
  schemaPath: { type: [String, Array], default: () => [] },
  showActive: { type: Boolean, default: true },
  texts: { type: Object, default: () => ({}) },
  ui: { type: Object, default: () => ({}) },
});

const globalStore = useStore();
const parentLinkCtx = inject(TASK_LINK_CONTEXT_KEY, null);

const schemaPathArr = computed(() => {
  const explicit = normalizeSchemaPath(props.schemaPath);
  if (explicit.length > 0) return explicit;
  return parentLinkCtx?.schemaPathSegments?.() ?? [];
});

const resolvedTaskType = computed(() => {
  const explicit = String(props.taskType ?? '').trim();
  if (explicit) return explicit;
  return parentLinkCtx?.taskType?.() ?? '';
});

provideTaskFieldAccess(() => [...schemaPathArr.value, props.linkField]);

provideTaskLinkContext({
  getSchemaPath: () => schemaPathArr.value,
  getTaskType: () => resolvedTaskType.value,
  getLinkField: () => props.linkField,
});

const phoneListKeys = computed(() =>
  Object.keys(
    globalStore.store[props.parentCollection]?.[props.parentId]?.[props.linkField] || {},
  ).filter(Boolean),
);
</script>
