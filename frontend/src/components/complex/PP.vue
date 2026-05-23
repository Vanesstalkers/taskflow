<template>
  <ComplexBlock
    v-if="parentId"
    :model-value="ppIds"
    :persist="{
      collection: 'pp',
      parentCollection,
      parentId,
      linkField,
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
          :context-key="ppId"
        />
        <Input
          v-if="isShown('firstName')"
          v-model="record.firstName"
          collection="pp"
          :_id="ppId"
          field="firstName"
          label="Имя"
          :context-key="ppId"
        />
        <Input
          v-if="isShown('middleName')"
          v-model="record.middleName"
          collection="pp"
          :_id="ppId"
          field="middleName"
          label="Отчество"
          :context-key="ppId"
        />
        <Input
          v-if="isShown('birthDate')"
          v-model="record.birthDate"
          collection="pp"
          :_id="ppId"
          field="birthDate"
          label="Дата рождения"
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
          pick-stored-as-empty="unspecified"
          empty-stored-value=""
          :context-key="`${ppId}:gender`"
        />
        <ComplexBlock
          v-if="isShown('phoneList') && ppId"
          :model-value="phoneListKeyList(ppId)"
          :list="{ lstName: 'phoneTypes' }"
          :persist="{
            collection: 'phone',
            parentCollection: 'pp',
            parentId: ppId,
            linkField: 'phoneList',
          }"
          :add="{
            addType: 'select',
            addPlacement: 'inline',
            pickCreatesDocument: true,
            pickDocumentField: 'phoneType',
            showCreateNewOption: false,
          }"
          :ui="{ fullWidthLabels: true }"
          :texts="{
            blockTitle: 'Телефоны',
            emptyText: 'Телефоны не добавлены',
            addFieldLabel: 'Тип телефона',
            addPlaceholder: 'Выберите тип из списка',
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
              <Phone
                v-model:code="phoneRecord.code"
                v-model:number="phoneRecord.number"
                collection="phone"
                :_id="phoneId"
                label="Номер"
                :context-key="phoneId"
              />
              <Checkbox
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
      </div>
    </template>
  </ComplexBlock>
</template>

<script setup>
import { computed } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import Input from '../Input.vue';
import Phone from '../Phone.vue';
import Radio from '../Radio.vue';
import Select from '../Select.vue';
import Checkbox from '../Checkbox.vue';
import { useStore } from '../../stores/store.js';

const props = defineProps({
  parentId: { type: String, required: true },
  parentCollection: { type: String, required: true },
  linkField: { type: String, default: 'pp' },
  showFields: { type: Array, default: () => ['*'] },
  texts: { type: Object, default: () => ({}) },
  ui: { type: Object, default: () => ({}) },
});

const globalStore = useStore();

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

function phoneListKeyList(ppId) {
  return Object.keys(globalStore.store.pp?.[ppId]?.phoneList || {}).filter(Boolean);
}
</script>
