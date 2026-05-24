({
  access: 'public',
  method: async ({ collection, document, link, taskType, schemaPath }) => {
    const data = {
      ...document,
      creator: document.creator || context.session.state.userId || '',
      createdAt: document.createdAt || new Date(),
    };

    await domain.collections.utils.ensureUniqueKeys.assertForInsert(collection, data);

    const result = await db.mongodb.insertOne(collection, data);
    const createdId = String(result.insertedId);

    const linkSchemaUtil = domain.collections.utils.linkSchema;
    const linkSchemaPathSegments = Array.isArray(schemaPath) ? schemaPath : [];
    const taskTypeKey = String(taskType || document.taskType || '').trim();

    let entitySchema;
    if (collection === 'task') {
      const taskDef = taskTypeKey ? domain.collections.task[taskTypeKey] : null;
      if (!taskDef || typeof taskDef.schema !== 'function') {
        throw new Error(`Неизвестный тип задачи: ${taskTypeKey || '(не указан)'}`);
      }
      entitySchema = taskDef.schema();
    } else {
      entitySchema = domain.collections[collection].schema();
    }

    if (taskTypeKey && link) {
      const { collection: parentCollection, linkField } = link;
      const linkFieldDef = linkSchemaUtil.resolveLinkFieldDef({
        taskType: taskTypeKey,
        collection: parentCollection,
        linkField,
        schemaPath: linkSchemaPathSegments,
      });
      entitySchema = linkSchemaUtil.schemaForLinkField(linkFieldDef, collection);
    }

    const viewer = await domain.collections.utils.fieldAccess.loadViewer(context.session.state.userId);
    const accessContext = { collection, entityId: createdId };
    const storePatch = {
      [collection]: {
        [createdId]: {
          ...linkSchemaUtil.pickDocumentForStore({ _id: createdId, ...data }, entitySchema, viewer, accessContext),
          ...linkSchemaUtil.getHiddenFieldsFromSchema(entitySchema, viewer, accessContext),
        },
      },
    };

    let linkedLst = {};

    if (link) {
      const { collection: parentCollection, _id: parentId, linkField, linkPayload = {} } = link;
      await domain.collections.utils.fieldAccess.assertLinkWritable({
        collection: parentCollection,
        _id: parentId,
        linkField,
        taskType: taskTypeKey,
        schemaPath: linkSchemaPathSegments,
        viewer,
        action: 'add',
        targetId: createdId,
        linkDocument: collection === 'userRole' ? data : null,
      });
      const updatedAt = new Date();
      const path = `${linkField}.${createdId}`;
      await db.mongodb.updateOne(
        parentCollection,
        { _id: new npm.mongodb.ObjectId(parentId) },
        { $set: { [path]: linkPayload, updatedAt } },
      );

      const parentEntry = { [linkField]: { [createdId]: linkPayload }, updatedAt };
      const prevParent = storePatch[parentCollection] || {};
      storePatch[parentCollection] = { ...prevParent, [parentId]: parentEntry };

      if (taskTypeKey) {
        linkedLst = await linkSchemaUtil.appendLinkedTargetToStorePatch({
          storePatch,
          taskType: taskTypeKey,
          schemaPath: linkSchemaPathSegments,
          parentCollection,
          linkField,
          targetCollection: collection,
          targetId: createdId,
          document: { _id: createdId, ...data },
          viewer,
        });
      }
    }

    context.client.emit('core/updateStore', storePatch);
    if (Object.keys(linkedLst).length > 0) {
      context.client.emit('core/updateLst', linkedLst);
    }

    return { status: 'ok', createdId };
  },
});
