import { getApi } from '../main.js';
import { BOARD_TAB_ID } from '../composables/useAppTabs.js';

const ALLOWED_TYPES = new Set(['collection-list', 'entity', 'task']);

export function sanitizeTab(tab) {
  if (!tab || typeof tab !== 'object') return null;

  const id = String(tab.id || '').trim();
  const type = String(tab.type || '').trim();
  const title = String(tab.title || '').trim();
  if (!id || id === BOARD_TAB_ID || !ALLOWED_TYPES.has(type) || !title) return null;

  if (type === 'collection-list') {
    const collection = String(tab.collection || '').trim();
    if (!collection) return null;
    return { id, type, title, collection, closable: true };
  }

  const collection = String(tab.collection || '').trim();
  const code = String(tab.code || '').trim();
  if (!collection || !code) return null;

  return {
    id,
    type,
    title,
    collection,
    code,
    groupTitle: String(tab.groupTitle || '').trim() || collection,
    closable: true,
  };
}

export async function saveUserTabs({ activeTabId, tabs }) {
  const method = getApi()?.core?.saveUserTabs;
  if (!method) throw new Error('API saveUserTabs недоступен');
  const response = await method({ activeTabId, tabs });
  if (response?.status !== 'ok') throw new Error('Не удалось сохранить вкладки');
  return response;
}
