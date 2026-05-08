import { defineStore } from "pinia";

export const useTasksStore = defineStore("tasks", {
  state: () => ({
    // Требуемая структура: { store: { task: { [taskId]: {...} } } }
    store: {
      task: {},
    },
  }),
  actions: {
    setTasks(tasks) {
      const normalized = {};
      for (const task of tasks) {
        normalized[task.id] = task;
      }
      this.store.task = normalized;
    },
    addTask({ title, description }) {
      const id = Date.now();
      this.store.task[id] = {
        id,
        title: title.trim(),
        description: description.trim(),
        status: "todo",
      };
    },
    moveTask(id, nextStatus) {
      const task = this.store.task[id];
      if (!task) return;
      task.status = nextStatus;
    },
  },
});
