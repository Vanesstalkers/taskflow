({
  access: 'public',
  method: async ({ activeTabId, tabs }) => {
    const userId = context.session.state.userId;

    const ALLOWED_TYPES = new Set(['collection-list', 'entity', 'task']);
    const MAX_TABS = 30;

    const sanitized = [];
    if (Array.isArray(tabs)) {
      for (const tab of tabs) {
        if (sanitized.length >= MAX_TABS) break;
        if (!tab || typeof tab !== 'object') continue;

        const id = String(tab.id || '').trim();
        const type = String(tab.type || '').trim();
        const title = String(tab.title || '').trim();
        if (!id || id === 'board' || !ALLOWED_TYPES.has(type) || !title) continue;

        if (type === 'collection-list') {
          const collection = String(tab.collection || '').trim();
          if (!/^[a-zA-Z0-9_-]+$/.test(collection)) continue;
          sanitized.push({ id, type, title, collection, closable: true });
          continue;
        }

        const collection = String(tab.collection || '').trim();
        const code = String(tab.code || '').trim();
        if (!/^[a-zA-Z0-9_-]+$/.test(collection) || !code) continue;

        sanitized.push({
          id,
          type,
          title,
          collection,
          code,
          groupTitle: String(tab.groupTitle || '').trim() || collection,
          closable: true,
        });
      }
    }

    let nextActive = String(activeTabId || 'board');
    if (nextActive !== 'board' && !sanitized.some((t) => t.id === nextActive)) {
      nextActive = sanitized.length > 0 ? sanitized[sanitized.length - 1].id : 'board';
    }

    const workspaceTabs = {
      activeTabId: nextActive,
      tabs: sanitized,
      updatedAt: new Date(),
    };

    const result = await db.mongodb.updateOne(
      'user',
      { _id: new npm.mongodb.ObjectId(userId) },
      { $set: { workspaceTabs } },
    );

    if (result.matchedCount === 0) {
      throw new Error('User not found');
    }

    return { status: 'ok', activeTabId: nextActive, tabs: sanitized };
  },
});
