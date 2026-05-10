({
  access: 'public',
  /**
   * Данные для панели задачи (форма): одна задача + связанные user / pp.
   * Доступ только если текущий пользователь есть в userLinks (как в tasksList).
   * Ответ: { error: null | string, store: { task, user, pp } } — те же сущности, что в window.store на фронте.
   */
  method: async ({ _id }) => {
    const result = { error: null, store: {} };

    const currentUserId = String(context.session.state.userId || '');
    if (!currentUserId) {
      result.error = 'unauthorized';
      return result;
    }
    if (typeof _id !== 'string' || !_id.trim()) {
      throw new Error('Parameter "id" must be a non-empty string');
    }

    const document = await db.mongodb.findOne('task', { _id: new npm.mongodb.ObjectId(_id.trim()) });
    if (!document) {
      return { error: 'not_found' };
    }

    const schema = domain.collections.task[document.taskType]?.schema();
    if (!schema) throw new Error('Invalid task type', { code: 400 });

    const taskId = String(document._id);
    const task = { _id: taskId };

    for (const [key, value] of Object.entries(schema)) {
      if (key in document) task[key] = document[key];

      const collection = value && value.collection;
      if (collection) {
        if (!task[key]) task[key] = {};

        const ids = Object.keys(document[key] || {}).map((oid) => new npm.mongodb.ObjectId(oid));
        const links = ids.length > 0 ? await db.mongodb.find(collection, { _id: { $in: ids } }) : [];

        if (!result.store[collection]) result.store[collection] = {};
        for (const link of links) {
          result.store[collection][link._id] = {
            ...link,
            _id: String(link._id),
            ...domain.collections.getHiddenFields(collection),
          };
        }
      }
    }

    result.store.task = { [taskId]: task };

    return result;
  },
});
