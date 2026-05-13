({
  access: 'public',
  method: async ({ collection, search = '', limit = 20 }) => {
    const currentUserId = context.session.state.userId;

    search = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (search.length < 3) return { items: [], currentUserId, collection };

    const searchFields = domain.collections[collection].searchFields || [];
    const projection = { _id: 1 };
    for (const field of searchFields) projection[field] = 1;

    const mapDocumentsToItems = (documents) =>
      documents.map((document) => {
        const row = { _id: String(document._id) };
        for (const field of searchFields) row[field] = document[field] ?? '';
        return row;
      });

    const query = {
      $or: searchFields.map((field) => ({
        [field]: { $regex: search, $options: 'i' },
      })),
    };

    const documents = await db.mongodb.find(collection, query, {
      projection,
      limit: Math.min(Math.max(limit, 1), 100),
    });

    return { items: mapDocumentsToItems(documents), currentUserId, collection };
  },
});
