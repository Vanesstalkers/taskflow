const modules = import.meta.glob('./*.vue', { eager: true });

function pascalFileBaseToTaskType(base) {
  if (!base) return '';
  return base.charAt(0).toLowerCase() + base.slice(1);
}

const byType = {};
for (const path of Object.keys(modules)) {
  const base = path.replace(/^\.\//, '').replace(/\.vue$/i, '');
  const key = pascalFileBaseToTaskType(base);
  if (!key) continue;
  const mod = modules[path];
  if (mod?.default) byType[key] = mod.default;
}

export function resolveTaskTypeMainComponent(taskType) {
  return byType[taskType];
}
