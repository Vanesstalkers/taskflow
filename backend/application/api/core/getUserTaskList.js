({
  access: 'public',
  method: async () => {
    const currentUserId = context.session.state.userId;

    function collectLstNamesFromSchema(schema) {
      const names = new Set();
      for (const def of Object.values(schema)) {
        if (def.lst) names.add(def.lst);
      }
      return names;
    }

    const documents = await db.mongodb.find(
      'task',
      { [`userLinks.${currentUserId}`]: { $exists: true } },
      { sort: { createdAt: -1 } },
    );

    const tasks = documents.map((document) => ({
      _id: String(document._id),
      title: document.title || '',
      taskType: document.taskType,
      status: document.status || 'todo',
      userLinks: document.userLinks || {},
      createdAt: document.createdAt || null,
      updatedAt: document.updatedAt || null,
    }));

    const userIds = new Set([currentUserId]);
    for (const task of tasks) {
      for (const userId of Object.keys(task.userLinks || {})) {
        if (userId) userIds.add(String(userId));
      }
    }

    const oidList = [...userIds].map((id) => new npm.mongodb.ObjectId(id));
    const usersData = await db.mongodb.find('user', { _id: { $in: oidList } }, { projection: { login: 1 } });
    const users = usersData.map((user) => ({
      _id: String(user._id),
      login: user.login || '',
    }));

    const lstNameSet = new Set();
    for (const task of tasks) {
      for (const name of collectLstNamesFromSchema(domain.collections.task[task.taskType].schema())) {
        lstNameSet.add(name);
      }
    }
    lstNameSet.add('taskTypes'); // актуально для первого открытия страницы (когда нет задач)

    const lst = Object.fromEntries([...lstNameSet].map((name) => [name, domain.lst[name].items]));
    return { tasks, users, lst };
  },
});
