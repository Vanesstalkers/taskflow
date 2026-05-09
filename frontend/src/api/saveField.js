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
 * @param {{ core?: { updateField?: (p: object) => Promise<unknown> } } | null | undefined} api
 * @param {{ collection: string, id: string, field: string, value: unknown }} params
 */
export async function saveField(api, params) {
  const method = api?.core?.updateField;
  if (!method) {
    throw new Error('API updateField недоступен');
  }
  const result = await method({
    collection: params.collection,
    id: String(params.id),
    field: params.field,
    value: params.value,
  });
  assertUpdateFieldOk(result);
  return result;
}

/**
 * backend/application/api/core/updateLink.js — одна связь в мапе (add/remove).
 * @param {{ core?: { updateLink?: (p: object) => Promise<unknown> } } | null | undefined} api
 * @param {{ collection: string, id: string, linkField: string, targetId: string, action: 'add' | 'remove', linkPayload?: Record<string, unknown> }} params
 */
export async function updateLink(api, params) {
  const method = api?.core?.updateLink;
  if (!method) {
    throw new Error('API updateLink недоступен');
  }
  const result = await method({
    collection: params.collection,
    id: String(params.id),
    linkField: params.linkField,
    targetId: String(params.targetId),
    action: params.action,
    ...(params.linkPayload !== undefined ? { linkPayload: params.linkPayload } : {}),
  });
  assertUpdateFieldOk(result);
  return result;
}
