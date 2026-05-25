({
  access: 'public',
  method: async ({ collection, _id, data, taskType, schemaPath, linkField }) => {
    const linkSchema = domain.collections.utils.linkSchema;
    const schema = linkSchema.resolveUpdateSchema({
      collection,
      taskType,
      schemaPath,
      linkField,
    });
    const viewer = await domain.collections.utils.fieldAccess.loadViewer(context.session.state.userId);
    const accessContext = { collection, entityId: String(_id || '').trim(), intent: 'write' };
    domain.collections.utils.fieldAccess.assertFieldsWritable(schema, data, viewer, accessContext);

    const setPayload = {};
    for (const [fieldName, fieldValue] of Object.entries(data)) {
      let normalized = fieldValue;
      const fieldDef = linkSchema.resolveFieldDef(schema[fieldName]);
      if (fieldDef?.onUpdate) {
        normalized = await fieldDef.onUpdate(fieldValue);
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
          ...(await domain.collections.utils.fieldAccess.getHiddenFieldsFromSchema(schema, viewer, {
            ...accessContext,
            intent: 'write',
          })),
        },
      },
    });

    return { status: 'ok' };
  },
});
