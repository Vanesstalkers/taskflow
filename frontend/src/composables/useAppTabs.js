import { ref } from 'vue';
import { sanitizeTab } from '../utils/userTabsActions.js';

export const BOARD_TAB_ID = 'board';

const BOARD_TAB = {
  id: BOARD_TAB_ID,
  type: 'board',
  title: 'Канбан',
  closable: false,
};

/** Вкладки главной области: канбан (закреплён) + объекты из поиска. */
export function useAppTabs() {
  const tabs = ref([{ ...BOARD_TAB }]);
  const activeTabId = ref(BOARD_TAB_ID);

  function restoreWorkspace({ activeTabId: savedActive, tabs: savedTabs } = {}) {
    const restored = (Array.isArray(savedTabs) ? savedTabs : [])
      .map((tab) => sanitizeTab(tab))
      .filter(Boolean);

    tabs.value = [{ ...BOARD_TAB }, ...restored];

    const active = String(savedActive || '').trim();
    activeTabId.value = tabs.value.some((t) => t.id === active) ? active : BOARD_TAB_ID;
  }

  function serializeWorkspace() {
    const closableTabs = tabs.value
      .filter((t) => t.closable)
      .map((tab) => sanitizeTab(tab))
      .filter(Boolean);

    return {
      activeTabId: activeTabId.value,
      tabs: closableTabs,
    };
  }

  function openCollectionListTab({ collection, title }) {
    const col = String(collection || '').trim();
    if (!col) return null;

    const tabId = `list:${col}`;
    const tabTitle = String(title || '').trim() || col;

    const existing = tabs.value.find((t) => t.id === tabId);
    if (existing) {
      activeTabId.value = tabId;
      return tabId;
    }

    tabs.value.push({
      id: tabId,
      type: 'collection-list',
      collection: col,
      title: tabTitle,
      closable: true,
    });
    activeTabId.value = tabId;
    return tabId;
  }

  function openSearchResultTab({ kind, collection, code, title, groupTitle }) {
    const col = kind === 'task' ? 'task' : String(collection || '').trim();
    const id = String(code || '').trim();
    if (!col || !id) return null;

    const tabId = `${col}:${id}`;
    const tabTitle = String(title || '').trim() || id;

    const existing = tabs.value.find((t) => t.id === tabId);
    if (existing) {
      activeTabId.value = tabId;
      return tabId;
    }

    tabs.value.push({
      id: tabId,
      type: kind === 'task' ? 'task' : 'entity',
      collection: col,
      code: id,
      title: tabTitle,
      groupTitle: String(groupTitle || '').trim() || col,
      closable: true,
    });
    activeTabId.value = tabId;
    return tabId;
  }

  function closeTab(tabId) {
    if (tabId === BOARD_TAB_ID) return;
    const index = tabs.value.findIndex((t) => t.id === tabId);
    if (index <= 0) return;
    tabs.value.splice(index, 1);
    if (activeTabId.value === tabId) {
      const fallback = tabs.value[index - 1] || tabs.value[0];
      activeTabId.value = fallback?.id || BOARD_TAB_ID;
    }
  }

  return {
    tabs,
    activeTabId,
    openSearchResultTab,
    openCollectionListTab,
    closeTab,
    restoreWorkspace,
    serializeWorkspace,
    BOARD_TAB_ID,
  };
}
