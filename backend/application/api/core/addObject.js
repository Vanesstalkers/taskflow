({
  access: 'public',
  method: async ({ collection, document, link }) => {
    const data = {
      ...document,
      creator: document.creator || context.session.state.userId || '',
      createdAt: document.createdAt || new Date(),
    };

    await domain.collections.utils.ensureUniqueKeys.assertForInsert(collection, data);

    const result = await db.mongodb.insertOne(collection, data);
    const createdId = String(result.insertedId);
    const createdPatch = { _id: createdId, ...data };

    const storePatch = { [collection]: { [createdId]: createdPatch } };

    if (link) {
      const { collection: parentCollection, _id: parentId, linkField, linkPayload = {} } = link;
      const updatedAt = new Date();
      const path = `${linkField}.${createdId}`;
      await db.mongodb.updateOne(
        parentCollection,
        { _id: new npm.mongodb.ObjectId(parentId) },
        { $set: { [path]: linkPayload, updatedAt } },
      );

      // TIP: collection и parentCollection могут быть одинаковыми
      const parentEntry = { [linkField]: { [createdId]: linkPayload }, updatedAt };
      const prevParent = storePatch[parentCollection] || {};
      storePatch[parentCollection] = { ...prevParent, [parentId]: parentEntry };
    }

    context.client.emit('core/updateStore', storePatch);

    return { status: 'ok' };
  },
});
