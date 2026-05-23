async ({ store, fetchedEntity, lstNameSet, collectionName, documents, schema }) => {
  const mergeLstNamesFromSchema = (nameSet, sch) => {
    for (const def of Object.values(sch)) {
      if (def.lst) nameSet.add(def.lst);
    }
  };

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

    if (!store[nestedColl]) store[nestedColl] = {};
    for (const nd of nestedDocs) {
      const outId = String(nd._id);
      fetchedEntity.add(`${nestedColl}:${outId}`);

      const hiddenFields = domain.collections.utils.getHiddenFields({
        collection: nestedColl,
        taskType: nd.taskType,
      });
      store[nestedColl][outId] = { ...nd, _id: outId, ...hiddenFields };
    }

    if (nestedDocs.length > 0) {
      const nestedSchema = domain.collections[nestedColl].schema();
      await domain.collections.utils.expandLinkedChain({
        store,
        fetchedEntity,
        lstNameSet,
        collectionName: nestedColl,
        documents: nestedDocs,
        schema: nestedSchema,
      });
    }
  }
};
