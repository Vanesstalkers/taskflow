import { defineStore } from "pinia";

export const useTasksStore = defineStore("tasks", {
  state: () => ({
    // Требуемая структура: { store: { task: {...}, user: {...} } }
    store: {
      task: {},
      user: {},
      currentAccountId: "",
    },
  }),
  actions: {
    setTasksData({ tasks = [], users = [], currentAccountId = "" }) {
      const normalizedTasks = {};
      for (const task of tasks) {
        normalizedTasks[task.id] = task;
      }
      const normalizedUsers = { ...this.store.user };
      for (const user of users) {
        normalizedUsers[String(user.accountId)] = user;
      }
      this.store.task = normalizedTasks;
      this.store.user = normalizedUsers;
      this.store.currentAccountId = String(currentAccountId || this.store.currentAccountId || "");
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
