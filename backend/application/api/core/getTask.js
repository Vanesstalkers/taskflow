({
  access: 'public',
  method: async ({ _id }) => {
    const result = { error: null, store: {} };
    const lstNameSet = new Set();
    const fetchedEntity = new Set();

    function mergeLstNamesFromSchema(nameSet, sch) {
      for (const def of Object.values(sch)) {
        if (def.lst) nameSet.add(def.lst);
      }
    }

    async function expandLinkedChain(collectionName, documents, schema) {
      mergeLstNamesFromSchema(lstNameSet, schema);

      const byNested = new Map();
      const lstMergedForNestedColl = new Set();

      for (const doc of documents) {
        const sid = String(doc._id);
        fetchedEntity.add(`${collectionName}:${sid}`);

        for (const [fieldKey, fieldDef] of Object.entries(schema)) {
          const nestedColl = fieldDef.collection;
          if (!nestedColl) continue;
          if (!lstMergedForNestedColl.has(nestedColl)) {
            lstMergedForNestedColl.add(nestedColl);
            mergeLstNamesFromSchema(lstNameSet, domain.collections[nestedColl].schema());
          }
          const linkMap = doc[fieldKey] || {};
          for (const rawId of Object.keys(linkMap)) {
            const pair = `${nestedColl}:${rawId}`;
            if (fetchedEntity.has(pair)) continue;
            if (!byNested.has(nestedColl)) byNested.set(nestedColl, new Set());
            byNested.get(nestedColl).add(rawId);
          }
        }
      }

      for (const [nestedColl, idSet] of byNested) {
        const oids = [...idSet].map((rawId) => new npm.mongodb.ObjectId(rawId));
        const nestedDocs = await db.mongodb.find(nestedColl, { _id: { $in: oids } });

        if (!result.store[nestedColl]) result.store[nestedColl] = {};
        for (const nd of nestedDocs) {
          const outId = String(nd._id);
          fetchedEntity.add(`${nestedColl}:${outId}`);

          const hiddenFields = domain.collections.utils.getHiddenFields({
            collection: nestedColl,
            taskType: nd.taskType,
          });
          result.store[nestedColl][outId] = { ...nd, _id: outId, ...hiddenFields };
        }

        if (nestedDocs.length > 0) {
          const nestedSchema = domain.collections[nestedColl].schema();
          await expandLinkedChain(nestedColl, nestedDocs, nestedSchema);
        }
      }
    }

    const document = await db.mongodb.findOne('task', { _id: new npm.mongodb.ObjectId(_id) });
    const schema = domain.collections.task[document.taskType].schema();

    const task = { _id: String(document._id) };

    for (const [key, value] of Object.entries(schema)) {
      if (key in document) task[key] = document[key];
      if (value.collection && !task[key]) task[key] = {};
    }

    await expandLinkedChain('task', [document], schema);

    result.store.task = { [task._id]: task };
    result.lst = Object.fromEntries([...lstNameSet].map((name) => [name, domain.lst[name].items]));

    return result;
  },
});
