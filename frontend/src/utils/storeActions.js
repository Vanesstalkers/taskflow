import { getActivePinia } from 'pinia';
import { getApi, getBackendState } from '../api/backend.js';
import { useStore } from '../stores/store.js';
import { mergeDeep } from './mergeDeep.js';

/** ---------- WebSocket: патчи в срез Pinia `store` (task / user / …) ---------- */

function getStoreBuckets() {
  const pinia = getActivePinia();
  if (!pinia) return null;
  return useStore(pinia).store;
}

let isSubscribed = false;

export const applyStorePatch = (patch) => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
  const target = getStoreBuckets();
  if (!target || typeof target !== 'object') return;
  mergeDeep({ target, source: patch });
};

export const subscribeStoreUpdates = async () => {
  if (isSubscribed) return;
  const backend = getBackendState();
  if (!backend) return;
  const { api } = backend;
  if (!api?.core?.on) return;

  // Expected event payload: { [collection]: { [_id]: { ... } } }
  api.core.on('updateStore', applyStorePatch);

  isSubscribed = true;
};

/** ---------- RPC: updateField / updateLink / addObject ---------- */

/**
 * Успех только при теле ответа с status === 'ok'; иначе — ошибка (для UI и catch).
 * @param {unknown} result
 */
function assertUpdateFieldOk(result) {
  if (result && typeof result === 'object' && result.status === 'ok') {
    return;
  }
  const msg =
    (result && typeof result === 'object' && typeof result.message === 'string' && result.message.trim()) ||
    (result && typeof result === 'object' && typeof result.error === 'string' && result.error.trim()) ||
    'Сервер вернул ответ без status: ok';
  throw new Error(msg);
}

/**
 * Общий вызов backend/application/api/core/updateField.js (Metacom api.core.updateField).
 * @param {{ _id: string, collection: string, field: string, value: unknown }} params
 */
export async function saveField(params) {
  const api = getApi();
  const method = api?.core?.updateField;
  if (!method) {
    throw new Error('API updateField недоступен');
  }
  const { collection, _id, field, value } = params;
  const result = await method({ collection, _id, field, value });
  assertUpdateFieldOk(result);
  return result;
}

/**
 * backend/application/api/core/updateLink.js — одна связь в мапе (add/remove).
 * @param {{ collection: string, _id: string, linkField: string, targetId: string, action: 'add' | 'remove', linkPayload?: Record<string, unknown>, taskType?: string }} params
 */
export async function updateLink(params) {
  const api = getApi();
  const method = api?.core?.updateLink;
  if (!method) {
    throw new Error('API updateLink недоступен');
  }
  const { collection, _id, linkField, targetId, action, linkPayload = {}, taskType } = params;
  const result = await method({ collection, _id, linkField, targetId, action, linkPayload, taskType });
  assertUpdateFieldOk(result);
  return result;
}

/**
 * backend/application/api/core/addObject.js — создание документа.
 * @param {{ collection: string, document: Record<string, unknown>, link?: object }} params
 */
export async function addObject(params) {
  const api = getApi();
  const method = api?.core?.addObject;
  if (!method) {
    throw new Error('API addObject недоступен');
  }
  const { collection, document, link } = params;
  const result = await method({ collection, document, link });
  assertUpdateFieldOk(result);
  return result;
}
