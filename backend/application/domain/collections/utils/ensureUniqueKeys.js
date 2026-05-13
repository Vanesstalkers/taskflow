({
  async assertForInsert(collection, document) {
    const uniqueKeys =
      (document.taskType
        ? domain.collections.task[document.taskType].uniqueKey
        : domain.collections[collection].uniqueKey) || [];

    for (const field of uniqueKeys) {
      const v = document[field];
      if ((v ?? '') === '') continue;
      if (await db.mongodb.findOne(collection, { [field]: v }, { projection: { _id: 1 } })) {
        throw new Error(`Поле «${field}» должно быть уникальным`, { code: 400 });
      }
    }
  },

  async assertForFieldUpdate({ collection, _id, field, value, taskType }) {
    const uniqueKeys =
      (taskType ? domain.collections.task[taskType].uniqueKey : domain.collections[collection].uniqueKey) || [];

    if (!uniqueKeys.includes(field)) return;

    const oid = new npm.mongodb.ObjectId(_id);
    if (await db.mongodb.findOne(collection, { [field]: value, _id: { $ne: oid } }, { projection: { _id: 1 } })) {
      throw new Error(`Поле «${field}» должно быть уникальным`, { code: 400 });
    }
  },
});
