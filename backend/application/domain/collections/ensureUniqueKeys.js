({
  /**
   * Перед insert: для полей из `domain.collections[collection].uniqueKey` проверить отсутствие другого документа с тем же значением.
   * Пустые значения (`null`, `undefined`, `''`) не проверяются.
   */
  async assertForInsert(collection, document) {
    const mod = domain.collections[collection];
    const keys = mod?.uniqueKey;
    if (!mod || !Array.isArray(keys) || keys.length === 0) return;
    if (!document || typeof document !== 'object' || Array.isArray(document)) return;
    for (const field of keys) {
      if (typeof field !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(field)) continue;
      const v = document[field];
      if (v === undefined || v === null || v === '') continue;
      const existing = await db.mongodb.findOne(collection, { [field]: v }, { projection: { _id: 1 } });
      if (existing) {
        throw new Error(`Поле «${field}» должно быть уникальным`, { code: 400 });
      }
    }
  },

  /**
   * Перед обновлением поля: если оно в `uniqueKey`, значение не должно совпадать с другим документом (кроме текущего).
   */
  async assertForFieldUpdate(collection, _id, field, value) {
    const mod = domain.collections[collection];
    const keys = mod?.uniqueKey;
    if (!mod || !Array.isArray(keys) || keys.length === 0) return;
    if (!keys.includes(field)) return;
    if (value === undefined || value === null || value === '') return;
    if (typeof _id !== 'string' || !_id.trim()) return;
    let oid;
    try {
      oid = new npm.mongodb.ObjectId(_id);
    } catch {
      throw new Error('Invalid id');
    }
    const existing = await db.mongodb.findOne(
      collection,
      { [field]: value, _id: { $ne: oid } },
      { projection: { _id: 1 } },
    );
    if (existing) {
      throw new Error(`Поле «${field}» должно быть уникальным`, { code: 400 });
    }
  },
});
