({
  access: 'public',
  method: async ({ collection, _id, field, value, taskType }) => {
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

    const schema = taskType ? domain.collections.task[taskType].schema() : domain.collections[collection].schema();
    if (schema?.[field]?.onUpdate) value = await schema[field].onUpdate(value);

    const data = { collection, _id, field, value, taskType };
    await domain.collections.utils.ensureUniqueKeys.assertForFieldUpdate(data);

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
      [collection]: {
        [_id]: {
          [field]: value,
          updatedAt,
          ...domain.collections.utils.getHiddenFields({ collection, taskType }),
        },
      },
    });

    return { status: 'ok' };
  },
});
