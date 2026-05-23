({
  access: 'public',
  /**
   * Добавляет или удаляет одну связь в объекте-мапе на документе (как userLinks: { [id]: { ... } }).
   * @param {{
   *   collection: string,
   *   _id: string,
   *   linkField: string,
   *   targetId: string,
   *   action: 'add' | 'remove',
   *   linkPayload?: Record<string, unknown>,
   * }} params
   */
  method: async ({ collection, _id, linkField, targetId, action, linkPayload, taskType }) => {
    const updatedAt = new Date();
    const path = `${linkField}.${targetId}`;
    const payloadForAdd = linkPayload ?? {};

    const update =
      action === 'add'
        ? { $set: { [path]: payloadForAdd, updatedAt } }
        : { $unset: { [path]: '' }, $set: { updatedAt } };

    await db.mongodb.updateOne(collection, { _id: new npm.mongodb.ObjectId(_id) }, update);

    context.client.emit('core/updateStore', {
      [collection]: {
        [_id]: {
          [linkField]: { [targetId]: action === 'add' ? payloadForAdd : null },
          updatedAt,
        },
      },
    });

    const schema = taskType ? domain.collections.task[taskType].schema() : domain.collections[collection].schema();
    const linkCollection = schema?.[linkField]?.collection;

    if (linkCollection && action === 'add') {
      const document = await db.mongodb.findOne(
        linkCollection,
        { _id: new npm.mongodb.ObjectId(targetId) },
        {
          // TODO: restore projection
          // projection: {
          //   ...Object.fromEntries(schema?.[linkField]?.fields?.map((field) => [field, 1]) || []),
          //   ...domain.collections.utils.getHiddenFields({ collection: linkCollection, taskType }),
          // },
        },
      );

      const linkedStore = {};
      const outId = String(document._id);
      const hiddenFields = domain.collections.utils.getHiddenFields({
        collection: linkCollection,
        taskType: document.taskType,
      });
      linkedStore[linkCollection] = {
        [outId]: { ...document, _id: outId, ...hiddenFields },
      };

      await domain.collections.utils.expandLinkedChain({
        store: linkedStore,
        fetchedEntity: new Set(),
        lstNameSet: new Set(),
        collectionName: linkCollection,
        documents: [document],
        schema: domain.collections[linkCollection].schema(),
      });

      context.client.emit('core/updateStore', linkedStore);
    }

    return { status: 'ok' };
  },
});
