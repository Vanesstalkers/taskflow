({
  access: 'public',
  method: async ({ search = '', limit = 20 } = {}) => {
    const safeSearch = typeof search === 'string' ? search.trim() : '';
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const currentAccountId = context.session?.accountId ? String(context.session.accountId) : '';

    if (!safeSearch || safeSearch.length < 3) {
      if (!currentAccountId) return { users: [], currentAccountId };
      const currentUser = await db.mongodb.findOne(
        'account',
        { accountId: currentAccountId },
        { projection: { _id: 0, accountId: 1, login: 1, fullName: 1 } },
      );
      if (!currentUser) return { users: [], currentAccountId };
      return {
        users: [
          {
            accountId: String(currentUser.accountId || ''),
            login: currentUser.login || '',
            fullName: currentUser.fullName || '',
          },
        ],
        currentAccountId,
      };
    }

    const escapedSearch = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = {
      $or: [
        { fullName: { $regex: escapedSearch, $options: 'i' } },
        { login: { $regex: escapedSearch, $options: 'i' } },
      ],
    };

    const documents = await db.mongodb.find('account', query, {
      projection: { _id: 0, accountId: 1, login: 1, fullName: 1 },
      sort: { login: 1 },
      limit: safeLimit,
    });

    const users = documents.map((document) => ({
      accountId: String(document.accountId || ''),
      login: document.login || '',
      fullName: document.fullName || '',
    }));

    return { users, currentAccountId };
  },
});
