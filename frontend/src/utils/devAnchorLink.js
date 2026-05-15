/**
 * Конвенция якоря связи ComplexBlock:
 *   {scope}.link.{parentCollection}.{linkField}
 * В DOM (без scope): link.{parentCollection}.{linkField}
 */

export function buildLinkPartialDevId(persist = {}) {
  const linkField = String(persist.linkField || '').trim();
  if (!linkField) return '';
  const parentCollection = String(persist.parentCollection || 'task').trim() || 'task';
  return `link.${parentCollection}.${linkField}`;
}

export function buildLinkDevId(scope, persist = {}, explicitDevId = '') {
  if (explicitDevId) return String(explicitDevId).trim();
  const partial = buildLinkPartialDevId(persist);
  if (!partial) return '';
  const scopePrefix = String(scope || '').trim();
  return scopePrefix ? `${scopePrefix}.${partial}` : partial;
}

export function parentSchemaFileFor(scope, parentCollection) {
  const parent = String(parentCollection || '').trim();
  if (!parent) return null;
  if (parent === 'task') {
    const taskType = String(scope || '').trim();
    if (!taskType) return null;
    return `backend/application/domain/collections/task/${taskType}.js`;
  }
  return `backend/application/domain/collections/${parent}.js`;
}
