({
  access: 'public',
  /**
   * Универсальный поиск по коллекции MongoDB.
   * Поля задаются в `domain.collections[collection].schema.searchFields` (массив имён строковых полей).
   * Коллекция `user`: при пустой строке или < 3 символов возвращается только текущий пользователь (если есть сессия).
   * Остальные коллекции: при строке короче 3 символов — пустой список.
   */
  method: async ({ collection, search = '', limit = 20 } = {}) => {
    const safeCollection = typeof collection === 'string' ? collection.trim() : '';
    const validCollection = /^[a-zA-Z0-9_-]+$/.test(safeCollection);
    if (!safeCollection || !validCollection) {
      return {
        items: [],
        currentUserId: String(context.session.state.userId || ''),
        collection: safeCollection,
      };
    }

    const searchFields = domain.collections[safeCollection].searchFields || [];

    const safeSearch = typeof search === 'string' ? search.trim() : '';
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const currentUserId = String(context.session.state.userId || '');

    if (searchFields.length === 0) {
      return { items: [], currentUserId, collection: safeCollection };
    }

    const projection = { _id: 1 };
    for (const field of searchFields) projection[field] = 1;

    const sortKey = searchFields[0];
    const sort = sortKey ? { [sortKey]: 1 } : { _id: 1 };

    const mapDocumentsToItems = (documents) =>
      documents.map((document) => {
        const row = { _id: String(document._id || '') };
        for (const field of searchFields) row[field] = document[field] ?? '';
        if (safeCollection === 'user') row.userId = row._id;
        return row;
      });

    if (safeCollection === 'user' && (!safeSearch || safeSearch.length < 3)) {
      if (!currentUserId) return { items: [], currentUserId, collection: safeCollection };
      let currentOid;
      try {
        currentOid = new npm.mongodb.ObjectId(currentUserId);
      } catch {
        return { items: [], currentUserId, collection: safeCollection };
      }
      const currentUser = await db.mongodb.findOne(safeCollection, { _id: currentOid }, { projection });
      if (!currentUser) return { items: [], currentUserId, collection: safeCollection };
      return {
        items: mapDocumentsToItems([currentUser]),
        currentUserId,
        collection: safeCollection,
      };
    }

    if (!safeSearch || safeSearch.length < 3) {
      return { items: [], currentUserId, collection: safeCollection };
    }

    const escapedSearch = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = {
      $or: searchFields.map((field) => ({
        [field]: { $regex: escapedSearch, $options: 'i' },
      })),
    };

    const documents = await db.mongodb.find(safeCollection, query, {
      projection,
      sort,
      limit: safeLimit,
    });

    return {
      items: mapDocumentsToItems(documents),
      currentUserId,
      collection: safeCollection,
    };
  },
});
