<template>
  <v-app>
    <v-main>
      <v-container class="app-content py-8">
        <div class="d-flex align-center justify-space-between mb-4">
          <div>
            <h1 class="text-h4 mb-1">Taskflow Kanban</h1>
            <p class="text-body-2 text-medium-emphasis">Статус backend: {{ status }}</p>
          </div>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="dialog = true">
            Новая задача
          </v-btn>
        </div>

        <v-alert v-if="errorText" type="error" variant="tonal" class="mb-4">
          {{ errorText }}
        </v-alert>

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
                  :key="task.id"
                  class="mb-3"
                  variant="elevated"
                >
                  <v-card-item>
                    <v-card-title class="text-subtitle-1">{{ task.title }}</v-card-title>
                    <v-card-subtitle>{{ task.description || "Без описания" }}</v-card-subtitle>
                  </v-card-item>
                  <v-card-actions>
                    <v-btn
                      size="small"
                      variant="text"
                      :disabled="!canMoveLeft(task.status) || movingTaskId === String(task.id)"
                      @click="moveTask(task.id, -1)"
                    >
                      Назад
                    </v-btn>
                    <v-spacer />
                    <v-btn
                      size="small"
                      color="primary"
                      variant="text"
                      :disabled="!canMoveRight(task.status) || movingTaskId === String(task.id)"
                      @click="moveTask(task.id, 1)"
                    >
                      Вперёд
                    </v-btn>
                  </v-card-actions>
                </v-card>

                <p
                  v-if="tasksByStatus[column.id].length === 0"
                  class="text-body-2 text-medium-emphasis ma-2"
                >
                  Пока нет задач
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <v-dialog v-model="dialog" max-width="560">
        <v-card>
          <v-card-title>Новая задача</v-card-title>
          <v-card-text>
            <v-text-field v-model="newTitle" label="Название" variant="outlined" class="mb-3" />
            <v-textarea v-model="newDescription" label="Описание" variant="outlined" rows="3" />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="closeDialog">Отмена</v-btn>
            <v-btn color="primary" :loading="creatingTask" @click="addTask">Создать</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { initBackend } from "./api/backend.js";
import { subscribeStoreUpdates } from "./api/storeUpdates.js";
import { useTasksStore } from "./stores/tasks.js";

const status = ref("Инициализация...");
const errorText = ref("");
const dialog = ref(false);
const newTitle = ref("");
const newDescription = ref("");
const creatingTask = ref(false);
const movingTaskId = ref("");
const tasksStore = useTasksStore();
let api = null;

const columns = [
  { id: "todo", title: "To Do" },
  { id: "inProgress", title: "In Progress" },
  { id: "done", title: "Done" },
];

const taskList = computed(() => Object.values(tasksStore.store.task));

const tasksByStatus = computed(() => ({
  todo: taskList.value.filter((task) => task.status === "todo"),
  inProgress: taskList.value.filter((task) => task.status === "inProgress"),
  done: taskList.value.filter((task) => task.status === "done"),
}));

const getColumnIndex = (statusId) => columns.findIndex((column) => column.id === statusId);

const canMoveLeft = (statusId) => getColumnIndex(statusId) > 0;
const canMoveRight = (statusId) => getColumnIndex(statusId) < columns.length - 1;

const moveTask = async (id, step) => {
  if (!api?.example?.taskMove) {
    errorText.value = "API taskMove недоступен";
    return;
  }
  const task = tasksStore.store.task[id];
  if (!task) return;
  const direction = step > 0 ? "forward" : "backward";
  errorText.value = "";
  movingTaskId.value = String(id);
  try {
    await api.example.taskMove({
      id: String(id),
      direction,
    });
  } catch (error) {
    errorText.value = `Ошибка обновления статуса: ${error.message}`;
  } finally {
    movingTaskId.value = "";
  }
};

const closeDialog = () => {
  dialog.value = false;
  newTitle.value = "";
  newDescription.value = "";
};

const addTask = async () => {
  if (!newTitle.value.trim()) {
    errorText.value = "Укажи название задачи";
    return;
  }
  errorText.value = "";
  if (!api?.example?.mongoInsertOne) {
    errorText.value = "API mongoInsertOne недоступен";
    return;
  }

  creatingTask.value = true;
  try {
    await api.example.mongoInsertOne({
      collection: "task",
      document: {
        title: newTitle.value.trim(),
        description: newDescription.value.trim(),
        status: "todo",
      },
    });
    closeDialog();
  } catch (error) {
    errorText.value = `Ошибка создания задачи: ${error.message}`;
  } finally {
    creatingTask.value = false;
  }
};

onMounted(async () => {
  try {
    const backend = await initBackend();
    api = backend.api;
    await subscribeStoreUpdates();
    const response = await api.example.tasksList();
    tasksStore.setTasks(response.tasks || []);
    status.value = "Подключено";
  } catch (error) {
    status.value = "Недоступен";
    errorText.value = `Не удалось подключиться к backend: ${error.message}`;
  }
});
</script>

<style scoped>
.app-content {
  max-width: 1200px;
}

.column-card {
  min-height: 420px;
}

.column-body {
  min-height: 340px;
}
</style>
