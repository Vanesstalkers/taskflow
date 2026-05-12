<template>
  <div>
    <ComplexBlock
      v-model="createdUserIds"
      :max-selection="1"
      add-field-label="Логин"
      add-placeholder="Введите логин и нажмите Enter"
      collection="user"
      parent-collection="task"
      :parent-id="task._id"
      link-field="createdUserLinks"
      :context-key="task._id"
      separate-create-button
      separate-create-as-input
      create-field="login"
      inline-separate-create
      hide-search-input
      full-width-labels
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
            :items="userRoleItems"
            pick-creates-document
            collection="userRole"
            parent-collection="user"
            :parent-id="_id"
            link-field="userRoleList"
            :context-key="_id"
            item-title="title"
            item-value="id"
            empty-text="Роли не выбраны"
            add-field-label="Роли"
            add-placeholder="Выберите роль из списка"
            :show-create-new-option="false"
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
  const id = String(userId || '').trim();
  return Object.keys(globalStore.store.user?.[id]?.userRoleList || {}).filter(Boolean);
}

const createdUserIds = computed({
  get: () => Object.keys(props.task?.createdUserLinks || {}).filter(Boolean),
  set: () => {},
});
</script>
