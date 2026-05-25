/**
 * Контекст связи для updateLink / addObject: taskType + schemaPath до схемы родителя.
 * schemaPath — ключи от task.schema (не включая linkField операции).
 */

const TASK_ROOT_LINK_FIELDS = ['createdEmployeeLinks', 'createdUserLinks', 'createdSubdivisionLinks'];

function hasLinkKey(links, id) {
  return links && typeof links === 'object' && !Array.isArray(links) && id in links;
}

/**
 * @param {string} collection — коллекция документа-родителя связи (куда пишется linkField)
 * @param {string} parentId — _id родителя
 * @param {object} store — globalStore.store
 */
export function findTaskLinkContext(collection, parentId, store) {
  const pid = String(parentId || '').trim();
  if (!pid || !store || typeof store !== 'object') return null;

  for (const task of Object.values(store.task || {})) {
    const taskType = String(task?.taskType || '').trim();
    if (!taskType) continue;
    const taskId = String(task?._id || '').trim();

    if (collection === 'task' && pid === taskId) {
      return { taskType, schemaPath: [] };
    }

    for (const linkField of TASK_ROOT_LINK_FIELDS) {
      if (hasLinkKey(task[linkField], pid)) {
        return { taskType, schemaPath: [linkField] };
      }
    }

    if (collection === 'user' && hasLinkKey(task.userLinks, pid)) {
      return { taskType, schemaPath: [] };
    }
    if (collection === 'doc' && hasLinkKey(task.docLinks, pid)) {
      return { taskType, schemaPath: [] };
    }

    for (const empId of Object.keys(task.createdEmployeeLinks || {})) {
      if (!hasLinkKey(task.createdEmployeeLinks, empId)) continue;
      const emp = store.employee?.[empId];
      if (!emp) continue;

      if (collection === 'employee') {
        if (hasLinkKey(emp.manager, pid)) return { taskType, schemaPath: ['createdEmployeeLinks'] };
        if (hasLinkKey(emp.subdivision, pid)) return { taskType, schemaPath: ['createdEmployeeLinks'] };
      }
      if (collection === 'pp' && hasLinkKey(emp.pp, pid)) {
        return { taskType, schemaPath: ['createdEmployeeLinks', 'pp'] };
      }

      for (const mgrId of Object.keys(emp.manager || {})) {
        const mgr = store.employee?.[mgrId];
        if (!mgr) continue;
        if (collection === 'pp' && hasLinkKey(mgr.pp, pid)) {
          return { taskType, schemaPath: ['createdEmployeeLinks', 'manager', 'pp'] };
        }
      }
    }

    for (const userId of Object.keys(task.createdUserLinks || {})) {
      if (!hasLinkKey(task.createdUserLinks, userId)) continue;
      const user = store.user?.[userId];
      if (!user) continue;

      if (collection === 'user' && hasLinkKey(user.userRoleList, pid)) {
        return { taskType, schemaPath: ['createdUserLinks', 'userRoleList'] };
      }
      if (collection === 'pp' && hasLinkKey(user.pp, pid)) {
        return { taskType, schemaPath: ['createdUserLinks', 'pp'] };
      }
    }

    for (const subId of Object.keys(task.createdSubdivisionLinks || {})) {
      if (!hasLinkKey(task.createdSubdivisionLinks, subId)) continue;
      const sub = store.subdivision?.[subId];
      if (!sub) continue;
      if (collection === 'phone' && hasLinkKey(sub.phoneList, pid)) {
        return { taskType, schemaPath: ['createdSubdivisionLinks'] };
      }
    }
  }

  return null;
}
