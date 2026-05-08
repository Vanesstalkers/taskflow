({
  access: 'public',
  method: async () => {
    const documents = await db.mongodb.find('task', {}, { sort: { createdAt: -1 } });
    const tasks = documents.map((document) => ({
      id: String(document._id),
      title: document.title || '',
      description: document.description || '',
      status: document.status || 'todo',
      assigneeAccountId: document.assigneeAccountId || '',
      createdAt: document.createdAt || null,
      updatedAt: document.updatedAt || null,
    }));
    const currentAccountId = context.session?.accountId ? String(context.session.accountId) : '';
    const accountIds = new Set();
    if (currentAccountId) accountIds.add(currentAccountId);
    for (const task of tasks) {
      if (task.assigneeAccountId) accountIds.add(String(task.assigneeAccountId));
    }

    let users = [];
    if (accountIds.size > 0) {
      const accounts = await db.mongodb.find(
        'account',
        { accountId: { $in: Array.from(accountIds) } },
        { projection: { _id: 0, accountId: 1, login: 1, fullName: 1 } },
      );
      users = accounts.map((account) => ({
        accountId: String(account.accountId || ''),
        login: account.login || '',
        fullName: account.fullName || '',
      }));
    }

    return { tasks, users, currentAccountId };
  },
});
