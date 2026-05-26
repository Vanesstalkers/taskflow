import { computed, inject, provide } from 'vue';

export const TASK_LINK_CONTEXT_KEY = Symbol('taskLinkContext');

/**
 * @typedef {{
 *   schemaPathSegments: () => string[],
 *   taskType: () => string,
 *   linkField: () => string,
 * }} TaskLinkContext
 */

export function normalizeSchemaPath(raw) {
  if (Array.isArray(raw)) return raw.map((k) => String(k).trim()).filter(Boolean);
  const one = String(raw ?? '').trim();
  return one ? one.split('.').map((k) => k.trim()).filter(Boolean) : [];
}

/**
 * Контекст связи в задаче для RPC (updateLink, addObject, saveField).
 * @param {{
 *   getSchemaPath?: string[] | (() => string[]),
 *   getTaskType?: string | (() => string),
 *   getLinkField?: string | (() => string),
 * }} options
 * @returns {TaskLinkContext}
 */
export function provideTaskLinkContext({ getSchemaPath, getTaskType, getLinkField } = {}) {
  const read = (value) => (typeof value === 'function' ? value() : value);

  const ctx = {
    schemaPathSegments: () => normalizeSchemaPath(read(getSchemaPath)),
    taskType: () => String(read(getTaskType) ?? '').trim(),
    linkField: () => String(read(getLinkField) ?? '').trim(),
  };

  provide(TASK_LINK_CONTEXT_KEY, ctx);
  return ctx;
}

/**
 * schemaPath / taskType / linkField: явные props → inject → значение по умолчанию.
 * @param {{ schemaPath?: string[] | string, taskType?: string, linkField?: string }} [props]
 */
export function useResolvedTaskLinkRpc(props = {}) {
  const ctx = inject(TASK_LINK_CONTEXT_KEY, null);

  const schemaPath = computed(() => {
    const explicit = normalizeSchemaPath(props.schemaPath);
    if (explicit.length > 0) return explicit;
    return ctx?.schemaPathSegments?.() ?? [];
  });

  const taskType = computed(() => {
    const explicit = String(props.taskType ?? '').trim();
    if (explicit) return explicit;
    return ctx?.taskType?.() ?? '';
  });

  const linkField = computed(() => {
    const explicit = String(props.linkField ?? '').trim();
    if (explicit) return explicit;
    return ctx?.linkField?.() ?? '';
  });

  return { schemaPath, taskType, linkField };
}
