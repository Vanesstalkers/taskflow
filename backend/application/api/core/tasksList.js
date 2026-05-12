({
  access: 'public',
  method: async () => {
    function getTaskSchemaByType(taskType) {
      const taskModule = domain.collections.task[taskType];
      if (taskModule && typeof taskModule.schema === 'function') {
        const schema = taskModule.schema();
        if (schema && typeof schema === 'object') return schema;
      }
      return domain.task.defaultSchema;
    }

    /** Собрать имена `domain.lst[name]` из полей схемы с атрибутом `lst`. */
    function collectLstNamesFromSchema(schema) {
      const names = new Set();
      if (!schema || typeof schema !== 'object') return names;
      for (const def of Object.values(schema)) {
        if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
        const lst = def.lst;
        if (typeof lst === 'string' && lst.trim()) names.add(lst.trim());
      }
      return names;
    }

    function buildLstPayload(nameSet) {
      const lst = {};
      for (const name of nameSet) {
        const list = domain.lst[name];
        if (list && Array.isArray(list.items)) lst[name] = list.items;
      }
      return lst;
    }

    const currentUserId = String(context.session.state.userId || '');
    if (!currentUserId) {
      return { tasks: [], users: [], currentUserId: '', lst: {} };
    }

    const documents = await db.mongodb.find(
      'task',
      { [`userLinks.${currentUserId}`]: { $exists: true } },
      { sort: { createdAt: -1 } },
    );
    const tasks = documents.map((document) => ({
      _id: String(document._id),
      title: document.title || '',
      description: document.description || '',
      taskType: document.taskType || 'feature',
      status: document.status || 'todo',
      userLinks: document.userLinks || {},
      createdAt: document.createdAt || null,
      updatedAt: document.updatedAt || null,
    }));

    const userIds = new Set();
    if (currentUserId) userIds.add(currentUserId);
    for (const task of tasks) {
      for (const userId of Object.keys(task.userLinks || {})) {
        if (userId) userIds.add(String(userId));
      }
    }

    let users = [];
    if (userIds.size > 0) {
      const oidList = [];
      for (const id of userIds) {
        try {
          oidList.push(new npm.mongodb.ObjectId(id));
        } catch {
          /* пропускаем невалидные ключи в userLinks */
        }
      }

      const usersData =
        oidList.length > 0
          ? await db.mongodb.find('user', { _id: { $in: oidList } }, { projection: { login: 1, fullName: 1 } })
          : [];
      users = usersData.map((user) => ({
        _id: String(user._id || ''),
        login: user.login || '',
        fullName: user.fullName || '',
      }));
    }

    const lstNameSet = new Set();
    for (const task of tasks) {
      const schema = getTaskSchemaByType(task.taskType);
      for (const name of collectLstNamesFromSchema(schema)) {
        lstNameSet.add(name);
      }
    }
    const lst = buildLstPayload(lstNameSet);

    return { tasks, users, currentUserId, lst };
  },
});
