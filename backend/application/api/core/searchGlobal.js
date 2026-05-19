({
  access: 'public',
  method: async ({ search = '', limit = 10 }) => {
    const currentUserId = context.session.state.userId;

    search = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (search.length < 3) return { groups: [], currentUserId };

    const perGroupLimit = Math.min(Math.max(limit, 1), 20);
    const groups = [];

    const mapDocumentsToItems = (documents, searchFields) =>
      documents.map((document) => {
        const code = String(document._id);
        const parts = searchFields
          .map((field) => document[field])
          .filter((v) => v !== null && String(v).trim() !== '');
        const title = parts.length > 0 ? parts.map((v) => String(v).trim()).join(' · ') : code;
        return { code, title };
      });

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

      const searchFields = domain.collections[collection]?.searchFields;
      if (!Array.isArray(searchFields) || searchFields.length === 0) continue;

      const projection = { _id: 1 };
      for (const field of searchFields) projection[field] = 1;

      const query = {
        $or: searchFields.map((field) => ({
          [field]: { $regex: search, $options: 'i' },
        })),
      };

      const documents = await db.mongodb.find(collection, query, {
        projection,
        limit: perGroupLimit,
      });

      if (documents.length === 0) continue;

      groups.push({
        kind: 'collection',
        collection,
        title: domain.collections[collection].title || collection,
        items: mapDocumentsToItems(documents, searchFields),
      });
    }

    return { groups, currentUserId };
  },
});
