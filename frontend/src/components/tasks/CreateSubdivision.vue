<template>
  <div>
    <ComplexBlock
      v-model="createdSubdivisionIds"
      :persist="{
        collection: 'subdivision',
        parentCollection: 'task',
        parentId: task._id,
        linkField: 'createdSubdivisionLinks',
        taskType: task.taskType,
        contextKey: task._id,
      }"
      :add="{
        addType: 'button',
        separateCreateButton: true,
        maxSelection: 1,
        minSelection: 1,
      }"
      :texts="{
        blockTitle: 'Подразделение',
        emptyText: 'Добавьте подразделение',
      }"
      :ui="{ fullWidthLabels: true }"
    >
      <template #label="{ _id, record = {} }">
        <div class="d-flex flex-column ga-2 align-self-stretch w-100">
          <Input
            v-model="record.name"
            collection="subdivision"
            :_id="_id"
            field="name"
            label="Название"
            :context-key="_id"
          />
          <Textarea
            v-model="record.description"
            collection="subdivision"
            :_id="_id"
            field="description"
            label="Описание"
            :context-key="_id"
          />
        </div>
      </template>
    </ComplexBlock>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import Input from '../Input.vue';
import Textarea from '../Textarea.vue';

const props = defineProps({
  task: { type: Object, required: true },
});

const createdSubdivisionIds = computed({
  get: () => Object.keys(props.task?.createdSubdivisionLinks || {}).filter(Boolean),
  set: () => {},
});
</script>
