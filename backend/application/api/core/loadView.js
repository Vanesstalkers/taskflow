({
  access: 'public',
  method: async () => {
    const userId = context.session.state.userId;

    const user = await db.mongodb.findOne(
      'user',
      { _id: new npm.mongodb.ObjectId(userId) },
      { projection: { workspaceTabs: 1 } },
    );

    const workspace = user?.workspaceTabs || {};
    const activeTabId = String(workspace.activeTabId || 'board');
    const tabs = Array.isArray(workspace.tabs) ? workspace.tabs : [];

    const collections = [];
    for (const collection of Object.keys(domain.collections)) {
      if (collection === 'task' || collection === 'utils') continue;

      const def = domain.collections[collection];
      const cfg = domain.collections.utils.searchConfig;
      if (!cfg.enabled(def)) continue;

      collections.push({
        collection,
        title: def.title || collection,
        fields: cfg.fields(def),
      });
    }
    collections.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));

    const favouriteDocuments = await db.mongodb.find(
      'favourite',
      { userId },
      { sort: { createdAt: 1 } },
    );

    const favourites = favouriteDocuments.map((doc) => ({
      _id: String(doc._id),
      title: String(doc.title || '').trim() || 'Избранное',
      icon: String(doc.icon || '').trim() || 'mdi-star',
      userId: String(doc.userId || ''),
      targetKind: String(doc.targetKind || ''),
      targetCollection: String(doc.targetCollection || ''),
      targetId: String(doc.targetId || ''),
      createdAt: doc.createdAt || null,
      updatedAt: doc.updatedAt || null,
    }));

    const remarkDocuments = await db.mongodb.find(
      'remark',
      { status: { $in: ['new', 'pending', 'review'] } },
      { projection: { _id: 1 } },
    );

    return {
      currentUserId: userId,
      activeTabId,
      tabs,
      collections,
      favourites,
      remarksBadgeCount: remarkDocuments.length,
    };
  },
});
