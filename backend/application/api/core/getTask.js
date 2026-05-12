({
  access: 'public',
  /**
   * Данные для панели задачи (форма): одна задача + связанные user / pp.
   * Доступ только если текущий пользователь есть в userLinks (как в tasksList).
   * Ответ: { error: null | string, store: { task, user, … }, lst: { … } } — сущности и справочники `domain.lst`.
   */
  method: async ({ _id }) => {
    function collectLstNamesFromSchema(schema) {
      const names = new Set();
      if (!schema || typeof schema !== 'object') return names;
      for (const def of Object.values(schema)) {
        if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
        const lst = def.lst;
        if (typeof lst === 'string' && lst.trim()) names.add(lst.trim());
      }
      return names;
    }

    function getCollectionSchema(collectionName) {
      if (typeof collectionName !== 'string' || !collectionName.trim()) return null;
      const mod = domain.collections[collectionName.trim()];
      if (!mod) return null;
      const s = mod.schema;
      if (typeof s === 'function') return s();
      if (s && typeof s === 'object') return s;
      return null;
    }

    function mergeLstNamesFromSchema(nameSet, sch) {
      for (const n of collectLstNamesFromSchema(sch)) nameSet.add(n);
    }

    function buildLstPayload(nameSet) {
      const lst = {};
      for (const name of nameSet) {
        const list = domain.lst[name];
        if (list && Array.isArray(list.items)) lst[name] = list.items;
      }
      return lst;
    }

    const result = { error: null, store: {}, lst: {} };
    const lstNameSet = new Set();
    /** Уже положили в `result.store` (чтобы не дублировать запросы и не зациклиться). */
    const fetchedEntity = new Set();

    /**
     * Рекурсивно: поля с `collection` — сбор справочников по схемам связей, загрузка вложенных документов, повтор.
     */
    async function expandLinkedChain(collectionName, documents, schema) {
      if (!schema || typeof schema !== 'object' || !Array.isArray(documents) || documents.length === 0) return;
      mergeLstNamesFromSchema(lstNameSet, schema);

      const byNested = new Map();
      const lstMergedForNestedColl = new Set();

      for (const doc of documents) {
        const sid = String(doc._id);
        fetchedEntity.add(`${collectionName}:${sid}`);

        for (const [fieldKey, fieldDef] of Object.entries(schema)) {
          const nestedColl = fieldDef && fieldDef.collection;
          if (!nestedColl) continue;
          if (!lstMergedForNestedColl.has(nestedColl)) {
            lstMergedForNestedColl.add(nestedColl);
            const nestedSch = getCollectionSchema(nestedColl);
            if (nestedSch) mergeLstNamesFromSchema(lstNameSet, nestedSch);
          }
          const linkMap = doc[fieldKey] || {};
          for (const rawId of Object.keys(linkMap)) {
            const idStr = String(rawId).trim();
            if (!idStr) continue;
            const pair = `${nestedColl}:${idStr}`;
            if (fetchedEntity.has(pair)) continue;
            if (!byNested.has(nestedColl)) byNested.set(nestedColl, new Set());
            byNested.get(nestedColl).add(idStr);
          }
        }
      }

      for (const [nestedColl, idSet] of byNested) {
        const oids = [];
        for (const idStr of idSet) {
          try {
            oids.push(new npm.mongodb.ObjectId(idStr));
          } catch {
            /* невалидный id в мапе связей */
          }
        }
        if (oids.length === 0) continue;

        const nestedDocs = await db.mongodb.find(nestedColl, { _id: { $in: oids } });
        const nestedSchema = getCollectionSchema(nestedColl);

        if (!result.store[nestedColl]) result.store[nestedColl] = {};
        for (const nd of nestedDocs) {
          const outId = String(nd._id);
          fetchedEntity.add(`${nestedColl}:${outId}`);
          result.store[nestedColl][outId] = {
            ...nd,
            _id: outId,
            ...domain.collections.getHiddenFields(nestedColl),
          };
        }

        if (nestedSchema && nestedDocs.length > 0) {
          await expandLinkedChain(nestedColl, nestedDocs, nestedSchema);
        }
      }
    }

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
      if (collection && !task[key]) task[key] = {};
    }

    await expandLinkedChain('task', [document], schema);

    result.store.task = { [taskId]: task };
    result.lst = buildLstPayload(lstNameSet);

    return result;
  },
});
