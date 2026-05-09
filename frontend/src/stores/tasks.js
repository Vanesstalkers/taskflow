import { defineStore } from "pinia";

export const useTasksStore = defineStore("tasks", {
  state: () => ({
    // Требуемая структура: { store: { task: {...}, user: {...} } }
    store: {
      task: {},
      user: {},
      currentUserId: "",
    },
  }),
  actions: {
    setTasksData({ tasks = [], users = [], currentUserId = "" }) {
      const normalizedTasks = {};
      for (const task of tasks) {
        normalizedTasks[task.id] = task;
      }
      const normalizedUsers = { ...this.store.user };
      for (const user of users) {
        normalizedUsers[String(user.userId)] = user;
      }
      this.store.task = normalizedTasks;
      this.store.user = normalizedUsers;
      this.store.currentUserId = String(currentUserId || this.store.currentUserId || "");
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
