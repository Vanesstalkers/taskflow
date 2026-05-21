({
  access: 'public',
  method: async ({ collection, _id, data, taskType }) => {
    const schema = taskType
      ? domain.collections.task[taskType].schema()
      : domain.collections[collection].schema();

    const setPayload = {};
    for (const [fieldName, fieldValue] of Object.entries(data)) {
      let normalized = fieldValue;
      if (schema?.[fieldName]?.onUpdate) {
        normalized = await schema[fieldName].onUpdate(fieldValue);
      }
      setPayload[fieldName] = normalized;
      await domain.collections.utils.ensureUniqueKeys.assertForFieldUpdate({
        collection,
        _id,
        field: fieldName,
        value: normalized,
        taskType,
      });
    }

    const updatedAt = new Date();
    await db.mongodb.updateOne(
      collection,
      { _id: new npm.mongodb.ObjectId(_id) },
      {
        $set: { ...setPayload, updatedAt },
        $setOnInsert: { createdAt: updatedAt },
      },
      { upsert: true },
    );

    context.client.emit('core/updateStore', {
      [collection]: {
        [_id]: {
          ...setPayload,
          updatedAt,
          ...domain.collections.utils.getHiddenFields({ collection, taskType }),
        },
      },
    });

    return { status: 'ok' };
  },
});
