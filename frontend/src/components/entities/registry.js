/**
 * Шаблоны карточки сущности по имени коллекции.
 * Файл `entities/<collection>.vue` → коллекция `<collection>`.
 * Если файла нет — используется EntityFormGeneric.
 */
const modules = import.meta.glob('./*.vue', { eager: true });

export function resolveEntityViewComponent(collection) {
  const key = String(collection || '').trim();
  if (!key) return null;
  const path = `./${key}.vue`;
  const mod = modules[path];
  return mod?.default ?? null;
}
