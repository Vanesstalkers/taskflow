({
  access: 'public',
  method: async ({ collection, _id, field, value }) => {
    // return { status: 'error' };

    const schema = domain.collections[collection].schema;
    if (schema?.[field]?.onUpdate) value = await schema[field].onUpdate(value);

    if (typeof collection !== 'string' || collection.length === 0) {
      throw new Error('Parameter "collection" must be a non-empty string');
    }
    const validCollection = /^[a-zA-Z0-9_-]+$/.test(collection);
    if (!validCollection) {
      throw new Error('Invalid collection name');
    }
    if (typeof _id !== 'string' || _id.length === 0) {
      throw new Error('Parameter "id" must be a non-empty string');
    }
    if (typeof field !== 'string' || field.length === 0) {
      throw new Error('Parameter "field" must be a non-empty string');
    }
    const validField = /^[a-zA-Z0-9_.-]+$/.test(field);
    if (!validField) {
      throw new Error('Invalid field name');
    }

    const updatedAt = new Date();
    const result = await db.mongodb.updateOne(
      collection,
      { _id: new npm.mongodb.ObjectId(_id) },
      { $set: { [field]: value, updatedAt } },
    );

    if (result.matchedCount === 0) {
      throw new Error('Object not found');
    }

    context.client.emit('core/updateStore', {
      [collection]: { [_id]: { [field]: value, updatedAt, ...domain.collections.getHiddenFields(collection) } },
    });

    return { status: 'ok' };
  },
});
