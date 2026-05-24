async ({ store, fetchedEntity, lstNameSet, collectionName, documents, schema, viewer = null }) => {
  const linkSchema = domain.collections.utils.linkSchema;

  linkSchema.mergeLstNamesFromSchema(lstNameSet, schema);

  const byNested = new Map();

  for (const doc of documents) {
    const sid = String(doc._id);
    fetchedEntity.add(`${collectionName}:${sid}`);

    for (const [fieldKey, fieldDef] of Object.entries(schema)) {
      const resolved = linkSchema.resolveFieldDef(fieldDef);
      const nestedColl = resolved?.collection;
      if (!nestedColl) continue;

      const nestedSchema = linkSchema.schemaForLinkField(fieldDef, nestedColl);
      linkSchema.mergeLstNamesFromSchema(lstNameSet, nestedSchema);
      const batchKey = linkSchema.batchKey(nestedColl, nestedSchema);

      const linkMap = doc[fieldKey] || {};
      for (const rawId of Object.keys(linkMap)) {
        const pair = `${nestedColl}:${rawId}`;
        if (fetchedEntity.has(pair)) continue;
        if (!byNested.has(batchKey)) {
          byNested.set(batchKey, { nestedColl, nestedSchema, idSet: new Set() });
        }
        byNested.get(batchKey).idSet.add(rawId);
      }
    }
  }

  for (const { nestedColl, nestedSchema, idSet } of byNested.values()) {
    const oids = [...idSet].map((rawId) => new npm.mongodb.ObjectId(rawId));
    const projection = linkSchema.projectionFromSchema(nestedSchema);
    const nestedDocs = await db.mongodb.find(nestedColl, { _id: { $in: oids } }, { projection });

    if (!store[nestedColl]) store[nestedColl] = {};
    for (const nd of nestedDocs) {
      const outId = String(nd._id);
      const accessContext = { collection: nestedColl, entityId: outId };
      const hiddenFields = linkSchema.getHiddenFieldsFromSchema(nestedSchema, viewer, accessContext);
      fetchedEntity.add(`${nestedColl}:${outId}`);
      store[nestedColl][outId] = {
        ...linkSchema.pickDocumentForStore(nd, nestedSchema, viewer, accessContext),
        ...hiddenFields,
      };
    }

    if (nestedDocs.length > 0) {
      await domain.collections.utils.expandLinkedChain({
        store,
        fetchedEntity,
        lstNameSet,
        collectionName: nestedColl,
        documents: nestedDocs,
        schema: nestedSchema,
        viewer,
      });
    }
  }
};
