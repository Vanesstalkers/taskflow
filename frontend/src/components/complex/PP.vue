<template>
  <ComplexBlock
    v-if="parentId"
    :model-value="ppIds"
    :persist="{
      collection: 'pp',
      parentCollection,
      parentId,
      linkField,
      taskType,
      schemaPath: linkSchemaPathArr,
    }"
    :add="{ addType: 'button', separateCreateButton: true, maxSelection: 1, minSelection: 1 }"
    :texts="{
      blockTitle: 'Персональные данные',
      emptyText: 'Данные не добавлены',
      ...texts,
    }"
    :ui="ui"
  >
    <template #label="{ _id: ppId, record = {} }">
      <div class="d-flex flex-column ga-2 align-self-stretch w-100">
        <Input
          v-if="isShown('lastName')"
          v-model="record.lastName"
          collection="pp"
          :_id="ppId"
          field="lastName"
          label="Фамилия"
          :access-path="ppAccessPath('lastName')"
          :context-key="ppId"
        />
        <Input
          v-if="isShown('firstName')"
          v-model="record.firstName"
          collection="pp"
          :_id="ppId"
          field="firstName"
          label="Имя"
          :access-path="ppAccessPath('firstName')"
          :context-key="ppId"
        />
        <Input
          v-if="isShown('middleName')"
          v-model="record.middleName"
          collection="pp"
          :_id="ppId"
          field="middleName"
          label="Отчество"
          :access-path="ppAccessPath('middleName')"
          :context-key="ppId"
        />
        <Input
          v-if="isShown('birthDate')"
          v-model="record.birthDate"
          collection="pp"
          :_id="ppId"
          field="birthDate"
          label="Дата рождения"
          :access-path="ppAccessPath('birthDate')"
          :context-key="ppId"
        />
        <Radio
          v-if="isShown('gender')"
          :model-value="record.gender"
          lst-name="genders"
          field-label="Пол"
          collection="pp"
          :_id="ppId"
          field="gender"
          :access-path="ppAccessPath('gender')"
          pick-stored-as-empty="unspecified"
          empty-stored-value=""
          :context-key="`${ppId}:gender`"
        />
        <PhoneList
          v-if="isShown('phoneList')"
          :parent-id="ppId"
          parent-collection="pp"
          :task-type="taskType"
          :schema-path="phoneLinkSchemaPath"
        />
      </div>
    </template>
  </ComplexBlock>
</template>

<script setup>
import { computed } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import Input from '../Input.vue';
import Radio from '../Radio.vue';
import PhoneList from './Phone.vue';
import { useStore } from '../../stores/store.js';
import { buildTaskAccessPath } from '../../utils/taskFieldAccess.js';

const props = defineProps({
  parentId: { type: String, required: true },
  parentCollection: { type: String, required: true },
  linkField: { type: String, default: 'pp' },
  taskType: { type: String, default: '' },
  linkSchemaPath: { type: [String, Array], default: () => [] },
  showFields: { type: Array, default: () => ['*'] },
  texts: { type: Object, default: () => ({}) },
  ui: { type: Object, default: () => ({}) },
});

const globalStore = useStore();

const linkSchemaPathArr = computed(() => {
  const raw = props.linkSchemaPath;
  if (Array.isArray(raw)) return raw.map((k) => String(k).trim()).filter(Boolean);
  const one = String(raw ?? '').trim();
  return one ? [one] : [];
});

const phoneLinkSchemaPath = computed(() => [...linkSchemaPathArr.value, 'pp']);

function ppAccessPath(field) {
  return buildTaskAccessPath([...linkSchemaPathArr.value, 'pp', field]);
}

const showAll = computed(() => props.showFields.includes('*'));
const shownSet = computed(() => new Set(props.showFields));

function isShown(field) {
  return showAll.value || shownSet.value.has(field);
}

const ppIds = computed(() =>
  Object.keys(globalStore.store[props.parentCollection]?.[props.parentId]?.[props.linkField] || {}).filter(
    Boolean,
  ),
);

</script>
