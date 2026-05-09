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
            :id="taskId"
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
      <v-btn variant="text" density="comfortable" icon class="flex-shrink-0" @click="$emit('close')">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-btn
        size="small"
        variant="tonal"
        :disabled="!canMoveLeft || movingTaskId === String(task.id)"
        @click="$emit('move', -1)"
      >
        Назад
      </v-btn>
      <v-btn
        size="small"
        color="primary"
        variant="tonal"
        :disabled="!canMoveRight || movingTaskId === String(task.id)"
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
    </v-tabs>
    <div class="task-detail-window mb-2">
      <div v-show="panelActiveTab === 'main'">
        <Textarea
          v-model="description"
          collection="task"
          :id="taskId"
          field="description"
          label="Описание"
          rows="4"
          :context-key="taskId"
        />
      </div>
      <div v-show="panelActiveTab === 'assignees'">
        <ComplexBlock
          v-model="assigneeUserIds"
          v-model:search="assigneeSearch"
          :items="assigneeOptions"
          :loading="assigneeLoading"
          :error="!!panelFieldErrors.assignees"
          :error-messages="panelFieldErrors.assignees ? [panelFieldErrors.assignees] : []"
          empty-text="Исполнители не выбраны"
          add-placeholder="Поиск по имени или логину (от 3 символов)"
          link-collection="task"
          :link-document-id="taskId"
          link-map-field="userLinks"
          :min-selection="1"
          :context-key="taskId"
          @link-remove-error="panelFieldErrors.assignees = $event"
          @link-removed="panelFieldErrors.assignees = ''"
          @link-add-error="panelFieldErrors.assignees = $event"
          @link-added="panelFieldErrors.assignees = ''"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onUnmounted, watch } from 'vue';
import ComplexBlock from './ComplexBlock.vue';
import InputInline from './InputInline.vue';
import Textarea from './Textarea.vue';
import { clearPanelFieldErrors, panelActiveTab, panelFieldErrors } from '../state/detailPanelState.js';

const description = defineModel('description', { type: String, default: '' });
const assigneeUserIds = defineModel('assigneeUserIds', { type: Array, default: () => [] });
const assigneeSearch = defineModel('assigneeSearch', { type: String, default: '' });

const props = defineProps({
  task: { type: Object, required: true },
  taskId: { type: String, required: true },
  taskTypeLabel: { type: String, default: 'Фича' },
  columnTitle: { type: String, default: '' },
  canMoveLeft: { type: Boolean, default: false },
  canMoveRight: { type: Boolean, default: false },
  movingTaskId: { type: String, default: '' },
  assigneeOptions: { type: Array, default: () => [] },
  assigneeLoading: { type: Boolean, default: false },
});

defineEmits(['close', 'move']);

watch(
  () => props.taskId,
  () => {
    clearPanelFieldErrors();
    panelActiveTab.value = 'main';
  },
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
