({
  access: 'public',
  method: async ({ collection, _id }) => {
    const result = { error: null, store: {} };
    const col = String(collection || '').trim();
    const id = String(_id || '').trim();
    if (!col || !id) {
      result.error = 'invalid_args';
      return result;
    }

    const def = domain.collections[col];
    if (!def || typeof def.schema !== 'function') {
      result.error = 'unknown_collection';
      return result;
    }

    const document = await db.mongodb.findOne(col, { _id: new npm.mongodb.ObjectId(id) });
    if (!document) {
      result.error = 'not_found';
      return result;
    }

    const schema = def.schema();
    const lstNameSet = new Set();
    const fetchedEntity = new Set();
    const sid = String(document._id);

    const viewer = await domain.collections.utils.fieldAccess.loadViewer(context.session.state.userId);

    await domain.collections.utils.expandLinkedChain({
      store: result.store,
      fetchedEntity,
      lstNameSet,
      collectionName: col,
      documents: [document],
      schema,
      viewer,
    });

    const linkSchemaUtil = domain.collections.utils.linkSchema;
    if (!result.store[col]) result.store[col] = {};
    const accessContext = { collection: col, entityId: sid };
    result.store[col][sid] = {
      ...linkSchemaUtil.pickDocumentForStore(document, schema, viewer, accessContext),
      ...linkSchemaUtil.getHiddenFieldsFromSchema(schema, viewer, accessContext),
    };

    result.lst = Object.fromEntries([...lstNameSet].map((name) => [name, domain.lst[name]?.items || []]));
    result.access = domain.collections.utils.fieldAccess.getSchemaAccessMap(schema, viewer, {
      collection: col,
      entityId: sid,
      intent: 'write',
    });
    return result;
  },
});
