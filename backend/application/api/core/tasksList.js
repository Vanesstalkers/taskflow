({
  access: 'public',
  method: async () => {
    const currentUserId = String(context.session.state.userId || '');
    if (!currentUserId) {
      return { tasks: [], users: [], currentUserId: '' };
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

    return { tasks, users, currentUserId };
  },
});
