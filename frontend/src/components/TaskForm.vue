<template>
  <div class="task-detail-inner pa-4">
    <div class="d-flex align-start justify-space-between mb-4 ga-2">
      <div class="task-detail-header-text flex-grow-1 pe-2">
        <div class="d-flex flex-column align-start ga-2 align-self-stretch">
          <InputInline
            :key="taskId"
            display-tag="h2"
            display-class="text-h6"
            :model-value="task.title || ''"
            empty-label="Без названия"
            collection="task"
            :_id="taskId"
            field="title"
            :error-message="panelFieldErrors.title"
            :context-key="taskId"
            @saved="panelFieldErrors.title = ''"
          />
          <v-chip size="small" variant="tonal">
            {{ taskTypeLabel }}
          </v-chip>
        </div>
      </div>
      <div v-if="!embedded" class="d-flex flex-shrink-0 ga-1">
        <v-btn
          variant="text"
          density="comfortable"
          icon
          aria-label="В избранное"
          @click="$emit('add-favourite')"
        >
          <v-icon>mdi-star-plus-outline</v-icon>
        </v-btn>
        <v-btn variant="text" density="comfortable" icon aria-label="Закрыть" @click="$emit('close')">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>
    </div>
    <div v-if="!embedded" class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-btn
        size="small"
        variant="tonal"
        :disabled="!canMoveLeft || movingTaskId === String(taskId)"
        @click="$emit('move', -1)"
      >
        Назад
      </v-btn>
      <v-btn
        size="small"
        color="primary"
        variant="tonal"
        :disabled="!canMoveRight || movingTaskId === String(taskId)"
        @click="$emit('move', 1)"
      >
        Вперёд
      </v-btn>
      <v-chip v-if="columnTitle" size="small" variant="outlined" class="ms-auto">
        {{ columnTitle }}
      </v-chip>
    </div>
    <v-tabs v-model="panelActiveTab" bg-color="transparent" density="compact" class="task-detail-tabs mb-2">
      <v-tab value="main">Основное</v-tab>
      <v-tab value="assignees">Исполнители</v-tab>
      <v-tab value="files">Файлы</v-tab>
    </v-tabs>
    <div class="task-detail-window mb-2">
      <div v-show="panelActiveTab === 'main'">
        <component :is="taskMainComponent" :task-id="taskId" :task="task" />
      </div>
      <div v-show="panelActiveTab === 'assignees'">
        <ComplexBlock
          v-model="assigneeUserIds"
          :persist="{
            collection: 'user',
            parentCollection: 'task',
            parentId: taskId,
            linkField: 'userLinks',
            taskType: task.taskType,
            contextKey: taskId,
          }"
          :texts="{
            emptyText: 'Исполнители не выбраны',
            addPlaceholder: 'Поиск по логину или ФИО (от 3 символов)',
          }"
          :add="{ addType: 'search', showCreateNewOption: false, minSelection: 1 }"
          :status="{
            error: !!panelFieldErrors.assignees,
            errorMessages: panelFieldErrors.assignees ? [panelFieldErrors.assignees] : [],
          }"
          @link-remove-error="panelFieldErrors.assignees = $event"
          @link-removed="panelFieldErrors.assignees = ''"
          @link-add-error="panelFieldErrors.assignees = $event"
          @link-added="panelFieldErrors.assignees = ''"
        />
      </div>
      <div v-show="panelActiveTab === 'files'">
        <ComplexBlock
          v-model="docIds"
          :persist="{
            collection: 'doc',
            parentCollection: 'task',
            parentId: taskId,
            linkField: 'docLinks',
            taskType: task.taskType,
            contextKey: taskId,
          }"
          :add="{ addType: 'file', addPlacement: 'inline', showCreateNewOption: false }"
          :status="{
            error: !!panelFieldErrors.files,
            errorMessages: panelFieldErrors.files ? [panelFieldErrors.files] : [],
          }"
          :ui="{ fullWidthLabels: true }"
          @link-remove-error="panelFieldErrors.files = $event"
          @link-removed="panelFieldErrors.files = ''"
          @link-add-error="panelFieldErrors.files = $event"
          @link-added="panelFieldErrors.files = ''"
        >
          <template #label="{ _id, record = {} }">
            <div class="d-flex flex-column ga-2 align-self-stretch w-100">
              <Input
                v-model="record.title"
                collection="doc"
                :_id="_id"
                field="title"
                label="Название"
                :context-key="_id"
              />
              <InputFile
                v-model="record.fileName"
                collection="doc"
                :_id="_id"
                field="fileName"
                label="Файл"
                :context-key="_id"
              />
            </div>
          </template>
        </ComplexBlock>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import ComplexBlock from './ComplexBlock.vue';
import Input from './Input.vue';
import InputFile from './InputFile.vue';
import InputInline from './InputInline.vue';
import { resolveTaskTypeMainComponent } from './tasks/registry.js';
import { useStore } from '../stores/store.js';

/** Ошибки полей детальной панели (валидация / сеть). */
const panelFieldErrors = reactive({
  title: '',
  assignees: '',
  files: '',
});

const panelActiveTab = ref('main');

function clearPanelFieldErrors() {
  panelFieldErrors.title = '';
  panelFieldErrors.assignees = '';
  panelFieldErrors.files = '';
}

const globalStore = useStore();
const currentUserId = computed(() => String(globalStore.currentUserId || ''));

const assigneeUserIds = ref([]);
const docIds = ref([]);

const props = defineProps({
  task: { type: Object, required: true },
  taskId: { type: String, required: true },
  taskTypeLabel: { type: String, default: '' },
  columnTitle: { type: String, default: '' },
  canMoveLeft: { type: Boolean, default: false },
  canMoveRight: { type: Boolean, default: false },
  movingTaskId: { type: String, default: '' },
  /** Вкладка поиска: без кнопок закрытия и переноса по колонкам */
  embedded: { type: Boolean, default: false },
});

defineEmits(['close', 'move', 'add-favourite']);

const taskMainComponent = computed(() => resolveTaskTypeMainComponent(props.task?.taskType));

function syncFromTask(task) {
  if (!task) return;
  docIds.value = Object.keys(task.docLinks || {}).filter(Boolean);
  const linkIds = Object.keys(task.userLinks || {}).filter(Boolean);
  assigneeUserIds.value = linkIds.length > 0 ? linkIds : currentUserId.value ? [currentUserId.value] : [];
}

watch(
  () => props.taskId,
  () => {
    clearPanelFieldErrors();
    panelActiveTab.value = 'main';
    if (props.task) syncFromTask(props.task);
  },
  { immediate: true },
);

watch(
  () => props.task,
  (task) => {
    if (!task || String(task._id) !== String(props.taskId)) return;
    syncFromTask(task);
  },
  { deep: true },
);

onUnmounted(() => {
  clearPanelFieldErrors();
  panelActiveTab.value = 'main';
});
</script>

<style scoped>
.task-detail-header-text {
  min-width: 0;
}

.task-detail-window {
  min-height: 200px;
}

.task-detail-inner {
  flex: 1;
  overflow: auto;
}
</style>
