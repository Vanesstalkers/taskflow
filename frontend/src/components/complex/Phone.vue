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
      taskType,
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
          :access-path="`${phoneAccessBase}.phoneType`"
          :context-key="`${phoneId}:phoneType`"
        />
        <PhoneNumber
          v-model:code="phoneRecord.code"
          v-model:number="phoneRecord.number"
          collection="phone"
          :_id="phoneId"
          label="Номер"
          :access-path-base="phoneAccessBase"
          :context-key="phoneId"
        />
        <Checkbox
          v-if="showActive"
          :model-value="Boolean(phoneRecord?.active)"
          label="Активный"
          :_id="phoneId"
          collection="phone"
          field="active"
          :task-type="taskType"
          :schema-path="activeSchemaPath"
          :link-field="linkField"
          :access-path="`${phoneAccessBase}.active`"
          :context-key="`${phoneId}:active`"
        />
      </div>
    </template>
  </ComplexBlock>
</template>

<script setup>
import { computed } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import PhoneNumber from '../Phone.vue';
import Select from '../Select.vue';
import Checkbox from '../Checkbox.vue';
import { useStore } from '../../stores/store.js';
import { buildTaskAccessPath } from '../../utils/taskFieldAccess.js';

const props = defineProps({
  parentId: { type: String, required: true },
  parentCollection: { type: String, required: true },
  linkField: { type: String, default: 'phoneList' },
  taskType: { type: String, default: '' },
  /** Путь от корня task.schema до схемы родителя связи phoneList */
  schemaPath: { type: [String, Array], default: () => [] },
  showActive: { type: Boolean, default: true },
  texts: { type: Object, default: () => ({}) },
  ui: { type: Object, default: () => ({}) },
});

const globalStore = useStore();

const schemaPathArr = computed(() => {
  const raw = props.schemaPath;
  if (Array.isArray(raw)) return raw.map((k) => String(k).trim()).filter(Boolean);
  const one = String(raw ?? '').trim();
  return one ? [one] : [];
});

/** Путь до схемы родителя phoneList (для updateField вложенной схемы). */
const activeSchemaPath = computed(() => schemaPathArr.value);

const phoneAccessBase = computed(() => buildTaskAccessPath([...schemaPathArr.value, props.linkField]));

const phoneListKeys = computed(() =>
  Object.keys(
    globalStore.store[props.parentCollection]?.[props.parentId]?.[props.linkField] || {},
  ).filter(Boolean),
);
</script>
