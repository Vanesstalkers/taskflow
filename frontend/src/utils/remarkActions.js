import { getApi } from '../main.js';

function assertOk(result) {
  if (result && typeof result === 'object' && result.status === 'ok') return result;
  const msg =
    (result && typeof result === 'object' && result.message) ||
    (result && typeof result === 'object' && result.error) ||
    'Сервер вернул ошибку';
  throw new Error(String(msg));
}

/**
 * @param {object} payload
 */
export async function saveRemark(payload) {
  const method = getApi()?.remarks?.saveRemark;
  if (!method) throw new Error('API saveRemark недоступен');
  const result = await method(payload);
  return assertOk(result);
}

/**
 * @param {{ limit?: number, status?: string }} [params]
 */
export async function getRemarks(params = {}) {
  const method = getApi()?.remarks?.getRemarks;
  if (!method) throw new Error('API getRemarks недоступен');
  const result = await method(params);
  return assertOk(result);
}

/**
 * @param {{ limit?: number }} [params]
 */
export async function getPendingRemarks(params = {}) {
  const method = getApi()?.remarks?.getPendingRemarks;
  if (!method) throw new Error('API getPendingRemarks недоступен');
  const result = await method(params);
  return assertOk(result);
}

/**
 * @param {{ _id: string, comment?: string }} params
 */
export async function revertRemark(params) {
  const method = getApi()?.remarks?.revertRemark;
  if (!method) throw new Error('API revertRemark недоступен');
  const result = await method(params);
  return assertOk(result);
}

/**
 * @param {{ _id: string, comment: string }} params
 */
export async function resubmitRemark(params) {
  const method = getApi()?.remarks?.resubmitRemark;
  if (!method) throw new Error('API resubmitRemark недоступен');
  const result = await method(params);
  return assertOk(result);
}

/**
 * @param {{ _id: string, status: string }} params
 */
export async function setRemarkStatus(params) {
  const method = getApi()?.remarks?.setRemarkStatus;
  if (!method) throw new Error('API setRemarkStatus недоступен');
  const result = await method(params);
  return assertOk(result);
}
