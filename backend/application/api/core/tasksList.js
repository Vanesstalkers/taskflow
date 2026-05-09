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
      id: String(document._id),
      title: document.title || '',
      description: document.description || '',
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
      const usersData = await db.mongodb.find(
        'user',
        { userId: { $in: Array.from(userIds) } },
        { projection: { _id: 0, userId: 1, login: 1, fullName: 1 } },
      );
      users = usersData.map((user) => ({
        userId: String(user.userId || ''),
        login: user.login || '',
        fullName: user.fullName || '',
      }));
    }

    return { tasks, users, currentUserId };
  },
});
