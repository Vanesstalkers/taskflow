<template>
  <v-row>
    <v-col v-for="column in columns" :key="column.id" cols="12" md="4">
      <v-card class="column-card" variant="tonal">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>{{ column.title }}</span>
          <v-chip size="small" color="primary" variant="outlined">
            {{ tasksByStatus[column.id].length }}
          </v-chip>
        </v-card-title>
        <v-divider />
        <v-card-text class="column-body">
          <v-card
            v-for="task in tasksByStatus[column.id]"
            :key="task._id"
            class="mb-3 task-card"
            variant="elevated"
          >
            <v-card-item class="task-card-main" @click="emit('open-task', task)">
              <template #append>
                <v-btn
                  icon="mdi-star-plus-outline"
                  variant="text"
                  size="x-small"
                  density="comfortable"
                  aria-label="В избранное"
                  @click.stop="emit('add-task-favourite', { taskId: task._id, title: task.title })"
                />
              </template>
              <v-card-title class="text-subtitle-1">{{ task.title }}</v-card-title>
              <div class="mt-2" @click.stop>
                <v-chip size="x-small" variant="tonal">
                  {{ taskTypeLabel(task.taskType) }}
                </v-chip>
              </div>
            </v-card-item>
          </v-card>

          <p v-if="tasksByStatus[column.id].length === 0" class="text-body-2 text-medium-emphasis ma-2">
            Пока нет задач
          </p>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from '../stores/store.js';

const props = defineProps({
  taskTypeLabelByValue: { type: Object, default: () => new Map() },
});

const emit = defineEmits(['open-task', 'add-task-favourite']);

const globalStore = useStore();

const columns = [
  { id: 'todo', title: 'To Do' },
  { id: 'inProgress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

const taskList = computed(() => Object.values(globalStore.store.task || {}));

const tasksByStatus = computed(() => ({
  todo: taskList.value.filter((task) => task.status === 'todo'),
  inProgress: taskList.value.filter((task) => task.status === 'inProgress'),
  done: taskList.value.filter((task) => task.status === 'done'),
}));

function taskTypeLabel(taskType) {
  const key = String(taskType || '');
  return props.taskTypeLabelByValue.get(key) || key;
}
</script>

<style scoped>
.column-card {
  min-height: 420px;
}

.column-body {
  min-height: 340px;
}

.task-card-main {
  cursor: pointer;
}
</style>
