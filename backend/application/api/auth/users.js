({
  access: 'public',
  method: async ({ search = '', limit = 20 } = {}) => {
    const safeSearch = typeof search === 'string' ? search.trim() : '';
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const currentUserId = String(context.session.state.userId || '');

    if (!safeSearch || safeSearch.length < 3) {
      if (!currentUserId) return { users: [], currentUserId };
      const currentUser = await db.mongodb.findOne(
        'user',
        { userId: currentUserId },
        { projection: { _id: 0, userId: 1, login: 1, fullName: 1 } },
      );
      if (!currentUser) return { users: [], currentUserId };
      return {
        users: [
          {
            userId: String(currentUser.userId || ''),
            login: currentUser.login || '',
            fullName: currentUser.fullName || '',
          },
        ],
        currentUserId,
      };
    }

    const escapedSearch = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = {
      $or: [
        { fullName: { $regex: escapedSearch, $options: 'i' } },
        { login: { $regex: escapedSearch, $options: 'i' } },
      ],
    };

    const documents = await db.mongodb.find('user', query, {
      projection: { _id: 0, userId: 1, login: 1, fullName: 1 },
      sort: { login: 1 },
      limit: safeLimit,
    });

    const users = documents.map((document) => ({
      userId: String(document.userId || ''),
      login: document.login || '',
      fullName: document.fullName || '',
    }));

    return { users, currentUserId };
  },
});
