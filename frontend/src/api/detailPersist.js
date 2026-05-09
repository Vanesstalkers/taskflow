import { saveField } from './saveField.js';

export function userLinksFromAssigneeIds(ids) {
  return Object.fromEntries(ids.map((userId) => [String(userId), {}]).filter(([userId]) => userId));
}

export function assigneeIdsSignature(ids) {
  return [...ids].map(String).filter(Boolean).sort().join(',');
}

/**
 * Сохранение только userLinks задачи (валидация как при полном сохранении панели).
 * @param {{ api: object | null | undefined, id: string, record: object | undefined, assigneeUserIds: unknown[] }} params
 */
export async function persistTaskUserLinks({ api, id, record, assigneeUserIds }) {
  if (!record) {
    return {
      type: 'validation',
      errors: { assignees: 'Задача не найдена' },
      openAssigneesTab: true,
    };
  }
  if (!api?.core?.updateField) {
    return {
      type: 'validation',
      errors: { assignees: 'API updateField недоступен' },
      openAssigneesTab: true,
    };
  }
  if (!(record.title || '').trim()) {
    return {
      type: 'validation',
      errors: { title: 'У задачи нет названия' },
    };
  }
  const assigneeIds = assigneeUserIds.map((value) => String(value)).filter(Boolean);
  if (assigneeIds.length === 0) {
    return {
      type: 'validation',
      errors: { assignees: 'Нужен хотя бы один исполнитель' },
      openAssigneesTab: true,
    };
  }

  try {
    const nextLinks = userLinksFromAssigneeIds(assigneeIds);
    const prevSig = assigneeIdsSignature(Object.keys(record.userLinks || {}));
    const nextSig = assigneeIdsSignature(assigneeIds);
    if (prevSig === nextSig) {
      return { type: 'ok' };
    }
    await saveField(api, { collection: 'task', id, field: 'userLinks', value: nextLinks });
    return { type: 'ok' };
  } catch (error) {
    return { type: 'network', message: error.message || 'Не удалось сохранить' };
  }
}
