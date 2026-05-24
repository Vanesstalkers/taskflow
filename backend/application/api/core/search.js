({
  access: 'public',
  method: async ({ collection, search = '', limit = 20 }) => {
    const currentUserId = context.session.state.userId;

    search = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (search.length < 3) return { items: [], currentUserId, collection };

    const cap = Math.min(Math.max(limit, 1), 100);
    const documents = await domain.collections.utils.runCollectionSearch({
      collection,
      search,
      limit: cap,
    });

    return {
      items: documents.map((document) => ({
        code: String(document._id),
        title: domain.collections.utils.searchItemTitle.fromDocument(collection, document),
      })),
      currentUserId,
      collection,
    };
  },
});
