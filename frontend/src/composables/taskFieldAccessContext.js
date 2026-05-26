import { computed, inject, provide } from 'vue';
import { buildTaskAccessPath } from '../utils/taskFieldAccess.js';

export const TASK_FIELD_ACCESS_KEY = Symbol('taskFieldAccess');

/**
 * @typedef {{ path: (field: string, ...extra: string[]) => string }} TaskFieldAccessContext
 */

/**
 * Контекст прав полей задачи для потомков (Input, Select, …).
 * @param {string[] | (() => string[])} getBaseSegments — префикс пути в taskSchema (без имени поля)
 * @returns {TaskFieldAccessContext}
 */
export function provideTaskFieldAccess(getBaseSegments) {
  const path = (field, ...extra) => {
    const base = typeof getBaseSegments === 'function' ? getBaseSegments() : getBaseSegments;
    const segments = Array.isArray(base) ? base : [];
    const fieldName = String(field || '').trim();
    const tail = extra.map((s) => String(s ?? '').trim()).filter(Boolean);
    return buildTaskAccessPath([...segments, ...tail, fieldName]);
  };
  const ctx = { path };
  provide(TASK_FIELD_ACCESS_KEY, ctx);
  return ctx;
}

/**
 * Путь в taskSchema: явный accessPath → inject path(field) → ''.
 * @param {{ accessPath?: string, field?: string }} props
 */
export function useResolvedTaskAccessPath(props) {
  const ctx = inject(TASK_FIELD_ACCESS_KEY, null);

  return computed(() => {
    const explicit = String(props.accessPath ?? '').trim();
    if (explicit) return explicit;

    const field = String(props.field ?? '').trim();
    if (!field || !ctx?.path) return '';

    return ctx.path(field);
  });
}
