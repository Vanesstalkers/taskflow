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
        maxSelection: 1,
        minSelection: 1,
      }"
      :texts="{
        addFieldLabel: 'Логин',
        addPlaceholder: 'Введите логин и нажмите Enter',
      }"
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
            :list="{ lstName: 'userRoles' }"
            :persist="{
              collection: 'userRole',
              parentCollection: 'user',
              parentId: _id,
              linkField: 'userRoleList',
              contextKey: _id,
            }"
            :add="{
              addType: 'select',
              pickCreatesDocument: true,
              allowDuplicatePickField: false,
              showCreateNewOption: false,
            }"
            :texts="{
              blockTitle: 'Роли',
              emptyText: 'Роли не выбраны',
              addFieldLabel: 'Роли',
              addPlaceholder: 'Выберите роль из списка',
            }"
          >
            <template #label="{ _id: roleId, record }">
              <span>{{ record?.type || roleId }}</span>
            </template>
          </ComplexBlock>
          <PP v-if="_id" :parent-id="_id" parent-collection="user" :show-fields="['*']" />
        </div>
      </template>
    </ComplexBlock>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import Input from '../Input.vue';
import InputFile from '../InputFile.vue';
import PP from '../complex/PP.vue';
import { useStore } from '../../stores/store.js';

const props = defineProps({
  task: { type: Object, required: true },
});

const globalStore = useStore();

onMounted(async () => {});

function userRoleListKeyList(userId) {
  return Object.keys(globalStore.store.user?.[userId]?.userRoleList || {}).filter(Boolean);
}

const createdUserIds = computed({
  get: () => Object.keys(props.task?.createdUserLinks || {}).filter(Boolean),
  set: () => {},
});
</script>
