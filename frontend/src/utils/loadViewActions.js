import { getApi } from '../main.js';

/**
 * backend/application/api/core/loadView.js — вкладки, поиск, избранное, бейдж замечаний.
 */
export async function loadView() {
  const method = getApi()?.core?.loadView;
  if (!method) throw new Error('API core.loadView недоступен');
  return method();
}
