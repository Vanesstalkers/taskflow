import { defineStore } from 'pinia';

export const useStore = defineStore('store', {
  state: () => ({
    currentUserId: '',
    lst: {},
    lstLoading: {},
    store: { user: {}, task: {} },
  }),
  actions: {
    setData({ store = {}, lst = {}, currentUserId = '' }) {
      this.currentUserId = String(currentUserId || this.currentUserId || '');

      for (const [key, value] of Object.entries(lst)) this.lst[key] = value;

      for (const [key, value] of Object.entries(store)) {
        if (!this.store[key]) this.store[key] = {};
      for (const item of Object.values(value)) {
        const id = String(item._id);
        this.store[key][id] = { ...(this.store[key][id] || {}), ...item };
      }
      }
    },

    async fetchLst({ name, getLst }) {
      const key = String(name || '').trim();
      if (!key || typeof getLst !== 'function') return false;
      this.lstLoading[key] = true;
      try {
        const response = await getLst({ name: key });
        this.lst[key] = Array.isArray(response?.items) ? response.items : [];
        return true;
      } catch {
        return false;
      } finally {
        this.lstLoading[key] = false;
      }
    },
  },
});
