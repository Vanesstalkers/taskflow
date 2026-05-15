<template>
  <div class="d-flex flex-column ga-4">
    <ComplexBlock
      v-model="employeeIds"
      :persist="{
        collection: 'employee',
        parentCollection: 'task',
        parentId: task._id,
        linkField: 'createdEmployeeLinks',
        contextKey: task._id,
      }"
      :add="{
        addType: 'button',
        separateCreateButton: true,
        maxSelection: 1,
        minSelection: 1,
      }"
      :texts="{
        blockTitle: 'Сотрудник',
        emptyText: 'Добавьте сотрудника',
      }"
      :ui="{ fullWidthLabels: true }"
    >
      <template #label="{ _id, record = {} }">
        <div class="d-flex flex-column ga-4 align-self-stretch w-100">
          <Select
            :model-value="record.position || ''"
            lst-name="jobTitles"
            label="Должность"
            collection="employee"
            :_id="_id"
            field="position"
            :context-key="`${_id}:position`"
          />
          <ComplexBlock
            v-if="_id"
            :model-value="subdivisionIds(_id)"
            :persist="{
              collection: 'subdivision',
              parentCollection: 'employee',
              parentId: _id,
              linkField: 'subdivision',
              contextKey: _id,
            }"
            :add="{
              addType: 'search',
              showCreateNewOption: false,
              minSelection: 1,
              maxSelection: 1,
            }"
            :texts="{
              blockTitle: 'Подразделение',
              emptyText: 'Выберите подразделение',
              addPlaceholder: 'Поиск по названию (от 3 символов)',
            }"
            :ui="{ fullWidthLabels: true }"
          >
            <template #label="{ _id: subdivisionId, record: subdivisionRecord = {} }">
              <span>{{ subdivisionRecord?.name || subdivisionId }}</span>
            </template>
          </ComplexBlock>
          <ComplexBlock
            v-if="_id"
            :model-value="ppIds(_id)"
            :persist="{
              collection: 'pp',
              parentCollection: 'employee',
              parentId: _id,
              linkField: 'pp',
              contextKey: _id,
            }"
            :add="{ addType: 'button', separateCreateButton: true, maxSelection: 1, minSelection: 1 }"
            :texts="{
              blockTitle: 'Персональные данные',
              emptyText: 'Данные не добавлены',
            }"
            :ui="{ fullWidthLabels: true }"
          >
            <template #label="{ _id: ppId, record: ppRecord = {} }">
              <div class="d-flex flex-column ga-2 align-self-stretch w-100">
                <Input
                  v-model="ppRecord.lastName"
                  collection="pp"
                  :_id="ppId"
                  field="lastName"
                  label="Фамилия"
                  :context-key="ppId"
                />
                <Input
                  v-model="ppRecord.firstName"
                  collection="pp"
                  :_id="ppId"
                  field="firstName"
                  label="Имя"
                  :context-key="ppId"
                />
                <Input
                  v-model="ppRecord.middleName"
                  collection="pp"
                  :_id="ppId"
                  field="middleName"
                  label="Отчество"
                  :context-key="ppId"
                />
              </div>
            </template>
          </ComplexBlock>
        </div>
      </template>
    </ComplexBlock>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import Input from '../Input.vue';
import Select from '../Select.vue';
import { useStore } from '../../stores/store.js';

const props = defineProps({
  task: { type: Object, required: true },
});

const globalStore = useStore();

const employeeIds = computed({
  get: () => Object.keys(props.task?.createdEmployeeLinks || {}).filter(Boolean),
  set: () => {},
});

function subdivisionIds(employeeId) {
  return Object.keys(globalStore.store.employee?.[employeeId]?.subdivision || {}).filter(Boolean);
}

function ppIds(employeeId) {
  return Object.keys(globalStore.store.employee?.[employeeId]?.pp || {}).filter(Boolean);
}
</script>
