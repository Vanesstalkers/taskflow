({
  access: 'public',
  method: async ({ search = '', limit = 10 }) => {
    const currentUserId = context.session.state.userId;

    search = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (search.length < 3) return { groups: [], currentUserId };

    const perGroupLimit = Math.min(Math.max(limit, 1), 20);
    const groups = [];

    const taskDocuments = await db.mongodb.find(
      'task',
      {
        [`userLinks.${currentUserId}`]: { $exists: true },
        title: { $regex: search, $options: 'i' },
      },
      {
        projection: { title: 1, status: 1, taskType: 1 },
        limit: perGroupLimit,
        sort: { updatedAt: -1 },
      },
    );

    if (taskDocuments.length > 0) {
      groups.push({
        kind: 'task',
        collection: 'task',
        title: domain.task.title || 'task',
        items: taskDocuments.map((document) => ({
          code: String(document._id),
          title: String(document.title || '').trim() || String(document._id),
        })),
      });
    }

    for (const collection of Object.keys(domain.collections)) {
      if (collection === 'task' || collection === 'utils') continue;

      const def = domain.collections[collection];
      if (!domain.collections.utils.searchConfig.enabled(def)) continue;

      const documents = await domain.collections.utils.runCollectionSearch({
        collection,
        search,
        limit: perGroupLimit,
      });

      if (documents.length === 0) continue;

      groups.push({
        kind: 'collection',
        collection,
        title: domain.collections[collection].title || collection,
        items: documents.map((document) => ({
          code: String(document._id),
          title: domain.collections.utils.searchItemTitle.fromDocument(collection, document),
        })),
      });
    }

    return { groups, currentUserId };
  },
});
