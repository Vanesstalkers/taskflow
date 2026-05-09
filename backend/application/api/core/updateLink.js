({
  access: 'public',
  /**
   * Добавляет или удаляет одну связь в объекте-мапе на документе (как userLinks: { [id]: { ... } }).
   * @param {{
   *   collection: string,
   *   id: string,
   *   linkField: string,
   *   targetId: string,
   *   action: 'add' | 'remove',
   *   linkPayload?: Record<string, unknown>,
   * }} params
   */
  method: async ({ collection, id, linkField, targetId, action, linkPayload }) => {
    if (typeof collection !== 'string' || collection.length === 0) {
      throw new Error('Parameter "collection" must be a non-empty string');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(collection)) {
      throw new Error('Invalid collection name');
    }
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('Parameter "id" must be a non-empty string');
    }
    if (typeof linkField !== 'string' || linkField.length === 0) {
      throw new Error('Parameter "linkField" must be a non-empty string');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(linkField)) {
      throw new Error('Invalid linkField name');
    }
    if (typeof targetId !== 'string' || targetId.length === 0) {
      throw new Error('Parameter "targetId" must be a non-empty string');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(targetId)) {
      throw new Error('Invalid targetId');
    }
    if (action !== 'add' && action !== 'remove') {
      throw new Error('Parameter "action" must be "add" or "remove"');
    }

    const _id = new npm.mongodb.ObjectId(id);
    const updatedAt = new Date();
    const path = `${linkField}.${targetId}`;

    const isPlainObject =
      linkPayload !== undefined &&
      linkPayload !== null &&
      typeof linkPayload === 'object' &&
      !Array.isArray(linkPayload);
    const payloadForAdd = isPlainObject ? linkPayload : {};

    let update;
    if (action === 'add') {
      update = { $set: { [path]: payloadForAdd, updatedAt } };
    } else {
      update = { $unset: { [path]: '' }, $set: { updatedAt } };
    }

    const result = await db.mongodb.updateOne(collection, { _id }, update);

    if (result.matchedCount === 0) {
      throw new Error('Object not found');
    }

    context.client.emit('core/updateStore', {
      [collection]: {
        [id]: {
          id,
          [linkField]: {
            [targetId]: action === 'add' ? payloadForAdd : null,
          },
          updatedAt,
        },
      },
    });

    return { status: 'ok' };
  },
});
