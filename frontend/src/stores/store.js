import { defineStore } from 'pinia';

export const useStore = defineStore('store', {
  state: () => ({
    currentUserId: '',
    /** Сырые `items` из `getLst({ name })`: ключ — имя справочника, значение — массив записей */
    lst: {},
    /** Флаги загрузки по имени справочника */
    lstLoading: {},
    store: { user: {}, task: {} }, // эти ключи используются до первого вызова setData
  }),
  actions: {
    setData({ store = {}, lst = {}, currentUserId = '' }) {
      this.currentUserId = String(currentUserId || this.currentUserId || '');

      for (const [key, value] of Object.entries(lst)) this.lst[key] = value;

      for (const [key, value] of Object.entries(store)) {
        if (!this.store[key]) this.store[key] = {};
        for (const item of Object.values(value)) {
          this.store[key][item._id] = item;
        }
      }
    },

    /**
     * Загрузить один справочник `lst` с бэкенда.
     * @param {{ name: string, getLst: (params: { name: string }) => Promise<{ items?: unknown[] }> }} params
     */
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
