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
          <ComplexBlock
            v-if="_id"
            :model-value="ppListKeyList(_id)"
            :persist="{
              collection: 'pp',
              parentCollection: 'user',
              parentId: _id,
              linkField: 'ppList',
              contextKey: _id,
            }"
            :add="{ addType: 'button', separateCreateButton: true, maxSelection: 1, minSelection: 1 }"
            :texts="{
              blockTitle: 'Персональные данные',
              emptyText: 'Записи не добавлены',
            }"
          >
            <template #label="{ _id: ppId, record = {} }">
              <div class="d-flex flex-column ga-2 align-self-stretch w-100">
                <Input
                  v-model="record.lastName"
                  collection="pp"
                  :_id="ppId"
                  field="lastName"
                  label="Фамилия"
                  :context-key="ppId"
                />
                <Input
                  v-model="record.firstName"
                  collection="pp"
                  :_id="ppId"
                  field="firstName"
                  label="Имя"
                  :context-key="ppId"
                />
                <Input
                  v-model="record.middleName"
                  collection="pp"
                  :_id="ppId"
                  field="middleName"
                  label="Отчество"
                  :context-key="ppId"
                />
                <Input
                  v-model="record.birthDate"
                  collection="pp"
                  :_id="ppId"
                  field="birthDate"
                  label="Дата рождения"
                  :context-key="ppId"
                />
                <Input v-model="record.gender" collection="pp" :_id="ppId" field="gender" label="Пол" :context-key="ppId" />
                <ComplexBlock
                  v-if="ppId"
                  :model-value="phoneListKeyList(ppId)"
                  :list="{ items: phoneTypeItems, itemTitle: 'title', itemValue: 'id' }"
                  :persist="{
                    collection: 'phone',
                    parentCollection: 'pp',
                    parentId: ppId,
                    linkField: 'phoneList',
                    contextKey: ppId,
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
                      <span class="text-body-2 text-medium-emphasis">{{ phoneTypeLabel(phoneRecord.phoneType) }}</span>
                      <Input
                        v-model="phoneRecord.number"
                        collection="phone"
                        :_id="phoneId"
                        field="number"
                        label="Номер"
                        :context-key="phoneId"
                      />
                    </div>
                  </template>
                </ComplexBlock>
              </div>
            </template>
          </ComplexBlock>
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
import { getApi } from '../../main.js';
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

const phoneTypeItems = computed(() => {
  const items = globalStore.lst.phoneTypes;
  return Array.isArray(items) ? items : [];
});

const phoneTypeLabelById = computed(() => {
  const m = new Map();
  for (const item of phoneTypeItems.value) {
    const id = item?.id != null && item.id !== '' ? String(item.id) : '';
    if (!id) continue;
    m.set(id, String(item?.title || id).trim() || id);
  }
  return m;
});

function phoneTypeLabel(typeId) {
  const id = typeId != null && typeId !== '' ? String(typeId) : '';
  if (!id) return '';
  return phoneTypeLabelById.value.get(id) || id;
}

onMounted(async () => {
  const getLst = getApi()?.core?.getLst;
  if (typeof getLst !== 'function') return;
  await globalStore.fetchLst({ name: 'phoneTypes', getLst });
});

function userRoleListKeyList(userId) {
  return Object.keys(globalStore.store.user?.[userId]?.userRoleList || {}).filter(Boolean);
}

function ppListKeyList(userId) {
  return Object.keys(globalStore.store.user?.[userId]?.ppList || {}).filter(Boolean);
}

function phoneListKeyList(ppId) {
  return Object.keys(globalStore.store.pp?.[ppId]?.phoneList || {}).filter(Boolean);
}

const createdUserIds = computed({
  get: () => Object.keys(props.task?.createdUserLinks || {}).filter(Boolean),
  set: () => {},
});
</script>
