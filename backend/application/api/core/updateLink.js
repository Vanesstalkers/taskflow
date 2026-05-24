({
  access: 'public',
  /**
   * Добавляет или удаляет одну связь в объекте-мапе на документе (как userLinks: { [id]: { ... } }).
   */
  method: async ({ collection, _id, linkField, targetId, action, linkPayload, taskType, schemaPath, linkDocument }) => {
    const viewer = await domain.collections.utils.fieldAccess.loadViewer(context.session.state.userId);
    await domain.collections.utils.fieldAccess.assertLinkWritable({
      collection,
      _id,
      linkField,
      taskType,
      schemaPath,
      viewer,
      action,
      targetId,
      linkDocument,
    });

    const updatedAt = new Date();
    const path = `${linkField}.${targetId}`;
    const payloadForAdd = linkPayload ?? {};

    const update =
      action === 'add'
        ? { $set: { [path]: payloadForAdd, updatedAt } }
        : { $unset: { [path]: '' }, $set: { updatedAt } };

    await db.mongodb.updateOne(collection, { _id: new npm.mongodb.ObjectId(_id) }, update);

    const storePatch = {
      [collection]: {
        [_id]: {
          [linkField]: { [targetId]: action === 'add' ? payloadForAdd : null },
          updatedAt,
        },
      },
    };

    const linkSchemaUtil = domain.collections.utils.linkSchema;
    const linkSchemaPathSegments = Array.isArray(schemaPath) ? schemaPath : [];
    const linkFieldDef = linkSchemaUtil.resolveLinkFieldDef({
      taskType,
      collection,
      linkField,
      schemaPath: linkSchemaPathSegments,
    });
    const resolvedLink = linkSchemaUtil.resolveFieldDef(linkFieldDef);
    const linkCollection = resolvedLink?.collection;

    let linkedLst = {};

    if (linkCollection && action === 'add') {
      if (taskType) {
        linkedLst = await linkSchemaUtil.appendLinkedTargetToStorePatch({
          storePatch,
          taskType,
          schemaPath: linkSchemaPathSegments,
          parentCollection: collection,
          linkField,
          targetCollection: linkCollection,
          targetId,
        });
      } else {
        const parentDef = domain.collections[collection];
        if (parentDef && typeof parentDef.schema === 'function') {
          const parentSchema = parentDef.schema();
          const linkFieldDef = linkSchemaUtil.resolveFieldDef(parentSchema[linkField]);
          if (linkFieldDef?.collection) {
            const nestedSchema = linkSchemaUtil.schemaForLinkField(linkFieldDef, linkCollection);
            const doc = await db.mongodb.findOne(linkCollection, {
              _id: new npm.mongodb.ObjectId(targetId),
            });
            if (doc) {
              const sid = String(doc._id);
              const nestedAccessContext = { collection: linkCollection, entityId: sid };
              if (!storePatch[linkCollection]) storePatch[linkCollection] = {};
              storePatch[linkCollection][sid] = {
                ...linkSchemaUtil.pickDocumentForStore(doc, nestedSchema, viewer, nestedAccessContext),
                ...linkSchemaUtil.getHiddenFieldsFromSchema(nestedSchema, viewer, nestedAccessContext),
              };
              const lstNameSet = new Set();
              linkSchemaUtil.mergeLstNamesFromSchema(lstNameSet, nestedSchema);
              linkedLst = Object.fromEntries(
                [...lstNameSet].map((name) => [name, domain.lst[name].items]),
              );
            }
          }
        }
      }
    }

    context.client.emit('core/updateStore', storePatch);
    if (Object.keys(linkedLst).length > 0) {
      context.client.emit('core/updateLst', linkedLst);
    }

    return { status: 'ok', lst: linkedLst, store: storePatch };
  },
});
