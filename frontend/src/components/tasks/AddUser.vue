<template>
  <div>
    <ComplexBlock
      v-model="createdUserIds"
      :persist="{
        collection: 'user',
        parentCollection: 'task',
        parentId: task._id,
        linkField: 'createdUserLinks',
        contextKey: task._id,
      }"
      :add="{
        addType: 'input',
        addPlacement: 'inline',
        createField: 'login',
      }"
      :texts="{
        addFieldLabel: 'Логин',
        addPlaceholder: 'Введите логин и нажмите Enter',
      }"
      :selection="{ maxSelection: 1 }"
      :ui="{ fullWidthLabels: true }"
    >
      <template #label="{ _id, record = {} }">
        <div class="d-flex flex-column ga-2 align-self-stretch w-100">
          <Input v-model="record.login" collection="user" :_id="_id" field="login" label="Логин" :context-key="_id" />
          <Input
            v-model="record.password"
            collection="user"
            :_id="_id"
            field="password"
            label="Пароль"
            type="password"
            :context-key="_id"
          />
          <InputFile
            v-model="record.avatar"
            collection="user"
            :_id="_id"
            field="avatar"
            label="Аватар"
            :context-key="_id"
          />
          <ComplexBlock
            v-if="_id"
            :model-value="userRoleListKeyList(_id)"
            :list="{ items: userRoleItems, itemTitle: 'title', itemValue: 'id' }"
            :persist="{
              collection: 'userRole',
              parentCollection: 'user',
              parentId: _id,
              linkField: 'userRoleList',
              contextKey: _id,
            }"
            :add="{ addType: 'select', pickCreatesDocument: true, showCreateNewOption: false }"
            :texts="{
              emptyText: 'Роли не выбраны',
              addFieldLabel: 'Роли',
              addPlaceholder: 'Выберите роль из списка',
            }"
          >
            <template #label="{ _id: roleId, record }">
              <span>{{ record?.type || roleId }}</span>
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
import InputFile from '../InputFile.vue';
import { useStore } from '../../stores/store.js';

const props = defineProps({
  task: { type: Object, required: true },
});

defineModel('description', { type: String, default: '' });

const globalStore = useStore();

const userRoleItems = computed(() => {
  const items = globalStore.lst.userRoles;
  return Array.isArray(items) ? items : [];
});

function userRoleListKeyList(userId) {
  return Object.keys(globalStore.store.user?.[userId]?.userRoleList || {}).filter(Boolean);
}

const createdUserIds = computed({
  get: () => Object.keys(props.task?.createdUserLinks || {}).filter(Boolean),
  set: () => {},
});
</script>
