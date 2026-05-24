<template>
  <v-dialog v-model="open" max-width="560">
    <v-card>
      <v-card-title>Новая задача</v-card-title>
      <v-form ref="createTaskFormRef" @submit.prevent="submit">
        <v-card-text>
          <v-text-field
            v-model="newTitle"
            label="Название"
            variant="outlined"
            class="mb-3"
            :disabled="creatingTask"
            :rules="newTitleRules"
            :maxlength="MAX_NEW_TITLE_LEN"
            counter
          />
          <v-select
            v-model="newTaskType"
            label="Тип задачи"
            variant="outlined"
            class="mt-3"
            :items="taskTypeOptions"
            item-value="code"
            :disabled="creatingTask || taskTypeLoading"
            :loading="taskTypeLoading"
            :rules="newTaskTypeRules"
          />
          <ComplexBlock
            v-model="assigneeUserIds"
            :persist="{ collection: 'user', contextKey: String(assigneePickerKey) }"
            :list="{ itemTitle: 'login', itemValue: '_id' }"
            :texts="{
              pickerLabel: 'Исполнитель',
              addPlaceholder: 'Поиск по логину или ФИО (от 3 символов)',
            }"
            :add="{ addType: 'search', showCreateNewOption: false, minSelection: 1 }"
          :ui="{ disabled: creatingTask }"
          class="mt-3"
        />
        </v-card-text>
        <v-alert v-if="createTaskError" type="error" variant="tonal" density="compact" class="mx-4 mb-2" role="alert">
          {{ createTaskError }}
        </v-alert>
        <v-card-actions>
          <v-spacer />
          <v-btn type="button" variant="text" @click="close">Отмена</v-btn>
          <v-btn type="submit" color="primary" :loading="creatingTask">Создать</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import ComplexBlock from './ComplexBlock.vue';
import { getApi } from '../main.js';
import { useStore } from '../stores/store.js';
import { normalizeUserLogin } from '../utils/userLabel.js';

const getTaskCreateMethod = () => getApi()?.core?.addObject;

const open = defineModel({ type: Boolean, default: false });

const globalStore = useStore();

const createTaskError = ref('');
const createTaskFormRef = ref(null);
const newTitle = ref('');
const newTaskType = ref('');
const assigneeUserIds = ref([]);
const assigneePickerKey = ref(0);
const creatingTask = ref(false);

const currentUserId = computed(() => String(globalStore.currentUserId || ''));

const taskTypeOptions = computed(() => {
  const raw = globalStore.lst.taskTypes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      title: String(item?.title || '').trim(),
      code: String(item?.code ?? item?.value ?? item?.id ?? '').trim(),
    }))
    .filter((o) => o.title && o.code);
});

const taskTypeLoading = computed(() => Boolean(globalStore.lstLoading.taskTypes));

const MAX_NEW_TITLE_LEN = 500;

const newTitleRules = [
  (v) => (v != null && String(v).trim() !== '') || 'Укажи название задачи',
  (v) => String(v ?? '').trim().length <= MAX_NEW_TITLE_LEN || `Не более ${MAX_NEW_TITLE_LEN} символов`,
];

const newTaskTypeRules = computed(() => {
  if (!taskTypeOptions.value.length) return [];
  return [(v) => (v != null && String(v).trim() !== '') || 'Выберите тип задачи'];
});

function resetFields() {
  createTaskError.value = '';
  newTitle.value = '';
  newTaskType.value = '';
  if (currentUserId.value) {
    assigneeUserIds.value = [currentUserId.value];
  }
}

function close() {
  open.value = false;
  resetFields();
}

async function submit() {
  createTaskError.value = '';
  const form = createTaskFormRef.value;
  if (form) {
    const { valid } = await form.validate();
    if (!valid) return;
  }
  const selectedAssigneeIds = assigneeUserIds.value.map((value) => String(value)).filter(Boolean);
  if (!selectedAssigneeIds.length) {
    createTaskError.value = 'Выберите хотя бы одного исполнителя';
    return;
  }
  const createTask = getTaskCreateMethod();
  if (typeof createTask !== 'function') {
    createTaskError.value = 'API addObject недоступен';
    return;
  }

  creatingTask.value = true;
  try {
    const userLinks = Object.fromEntries(selectedAssigneeIds.map((userId) => [userId, {}]));
    await createTask({
      collection: 'task',
      document: {
        title: newTitle.value.trim(),
        taskType: newTaskType.value,
        status: 'todo',
        userLinks,
      },
    });
    close();
  } catch (error) {
    createTaskError.value = `Ошибка создания задачи: ${error.message}`;
  } finally {
    creatingTask.value = false;
  }
}

function ensureCurrentUserInStore() {
  const id = currentUserId.value;
  if (!id) return;
  const src = globalStore.store.user?.[id] || {};
  const login = normalizeUserLogin(src.login);
  if (!globalStore.store.user) globalStore.store.user = {};
  globalStore.store.user[id] = {
    _id: id,
    ...(login ? { login } : {}),
    ...(src.pp && typeof src.pp === 'object' ? { pp: src.pp } : {}),
  };
}

watch(open, async (isOpen) => {
  if (!isOpen) return;
  createTaskError.value = '';
  ensureCurrentUserInStore();
  assigneePickerKey.value += 1;

  await nextTick();

  createTaskFormRef.value?.resetValidation();
  if (
    taskTypeOptions.value.length > 0 &&
    (!newTaskType.value || !taskTypeOptions.value.some((o) => o.code === newTaskType.value))
  ) {
    newTaskType.value = taskTypeOptions.value[0].code;
  }
  assigneeUserIds.value = currentUserId.value ? [currentUserId.value] : [];
});
</script>
