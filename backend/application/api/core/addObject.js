({
  access: 'public',
  method: async ({ collection, document, link }) => {
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
    if (link) {
      if (typeof link.collection !== 'string' || link.collection.length === 0) {
        throw new Error('Parameter "link.collection" must be a non-empty string');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(link.collection)) {
        throw new Error('Invalid link.collection');
      }
      if (typeof link._id !== 'string' || link._id.length === 0) {
        throw new Error('Parameter "link._id" must be a non-empty string');
      }
      if (typeof link.linkField !== 'string' || link.linkField.length === 0) {
        throw new Error('Parameter "link.linkField" must be a non-empty string');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(link.linkField)) {
        throw new Error('Invalid link.linkField');
      }
    }

    const data = {
      ...document,
      creator: document.creator || context.session.state.userId || '',
      createdAt: document.createdAt || new Date(),
    };

    await domain.collections.ensureUniqueKeys.assertForInsert(collection, data);

    const result = await db.mongodb.insertOne(collection, data);
    const createdId = String(result.insertedId);
    const createdPatch = { _id: createdId, ...data };

    if (link) {
      const { collection, _id, linkField, linkPayload } = link;
      const isPlainObject =
        linkPayload !== undefined &&
        linkPayload !== null &&
        typeof linkPayload === 'object' &&
        !Array.isArray(linkPayload);
      const payload = isPlainObject ? linkPayload : {};
      const updatedAt = new Date();
      const path = `${linkField}.${createdId}`;
      const updateResult = await db.mongodb.updateOne(
        collection,
        { _id: new npm.mongodb.ObjectId(_id) },
        { $set: { [path]: payload, updatedAt } },
      );
      if (updateResult.matchedCount === 0) {
        throw new Error('Link source object not found');
      }
      context.client.emit('core/updateStore', {
        [collection]: { [_id]: { [linkField]: { [createdId]: payload }, updatedAt } },
      });
    }

    context.client.emit('core/updateStore', { [collection]: { [createdId]: createdPatch } });

    return { status: 'ok' };
  },
});
