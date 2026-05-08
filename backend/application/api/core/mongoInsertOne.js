({
  access: 'public',
  method: async ({ collection, document }) => {
    if (typeof collection !== 'string' || collection.length === 0) {
      throw new Error('Parameter "collection" must be a non-empty string');
    }
    const validCollection = /^[a-zA-Z0-9_-]+$/.test(collection);
    if (!validCollection) {
      throw new Error('Invalid collection name');
    }
    const isObject = document && typeof document === 'object' && !Array.isArray(document);
    if (!isObject) {
      throw new Error('Parameter "document" must be an object');
    }

    const data = {
      ...document,
      createdAt: document.createdAt || new Date(),
    };

    const result = await db.mongodb.insertOne(collection, data);
    const id = String(result.insertedId);
    context.client.emit('example/store', {
      [collection]: {
        [id]: {
          id,
          ...data,
        },
      },
    });
    return { status: 'ok' };
  },
});
