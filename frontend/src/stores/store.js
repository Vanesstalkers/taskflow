import { defineStore } from 'pinia';

export const useStore = defineStore('store', {
  state: () => ({
    currentUserId: '',
    store: { user: {}, task: {} }, // эти ключи используются до первого вызова setData
  }),
  actions: {
    setData({ store = {}, currentUserId = '' }) {
      this.currentUserId = String(currentUserId || this.currentUserId || '');
      for (const [key, value] of Object.entries(store)) {
        if (!this.store[key]) this.store[key] = {};
        for (const item of Object.values(value)) {
          this.store[key][item._id] = item;
        }
      }
    },
  },
});
