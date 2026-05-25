import { getActivePinia } from 'pinia';
import { useStore } from '../stores/store.js';

function getTaskSchemaTree() {
  const pinia = getActivePinia();
  if (!pinia) return {};
  const tree = useStore(pinia).taskSchema;
  return tree && typeof tree === 'object' && !Array.isArray(tree) ? tree : {};
}

/**
 * @param {string | string[]} path — путь в result.schema от getTask (через точку или сегменты)
 * @returns {'write'|'readonly'|'hidden'|string}
 */
export function getTaskFieldAccess(path) {
  const parts =
    typeof path === 'string'
      ? path.split('.').map((p) => p.trim()).filter(Boolean)
      : (Array.isArray(path) ? path : []).map((p) => String(p).trim()).filter(Boolean);

  if (parts.length === 0) return 'write';

  let node = getTaskSchemaTree();
  for (const part of parts) {
    if (node == null || typeof node !== 'object' || Array.isArray(node)) return 'write';
    if (typeof node[part] === 'string') return node[part];
    node = node[part];
  }
  return 'write';
}

export function isTaskFieldReadonly(path) {
  return getTaskFieldAccess(path) === 'readonly';
}

/** readonly и hidden — поле не редактируется в UI */
export function isTaskFieldDisabled(path) {
  const level = getTaskFieldAccess(path);
  return level === 'readonly' || level === 'hidden';
}

export function buildTaskAccessPath(parts) {
  return (Array.isArray(parts) ? parts : [parts])
    .flat()
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join('.');
}
