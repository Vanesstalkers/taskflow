({
  resolveFieldDef(def) {
    if (typeof def === 'function') return def();
    return def;
  },

  resolveSchema(schema) {
    if (typeof schema === 'function') return schema();
    return schema;
  },

  /**
   * Поле связи в контексте задачи: schemaPath — ключи от корня task.schema до схемы родителя связи.
   * @param {{ taskType?: string, collection: string, linkField: string, schemaPath?: string[] }} params
   */
  resolveLinkFieldDef({ taskType, collection, linkField, schemaPath = [] }) {
    if (!taskType) {
      return this.resolveFieldDef(domain.collections[collection].schema()[linkField]);
    }

    const taskSchema = domain.collections.task[taskType].schema();

    if (collection === 'task') {
      return this.resolveFieldDef(taskSchema[linkField]);
    }

    let currentSchema = taskSchema;
    for (const key of schemaPath) {
      const def = this.resolveFieldDef(currentSchema[key]);
      if (!def?.collection) {
        return this.resolveFieldDef(domain.collections[collection].schema()[linkField]);
      }
      currentSchema = this.schemaForLinkField(def, def.collection);
    }

    if (linkField in currentSchema) {
      return this.resolveFieldDef(currentSchema[linkField]);
    }

    return this.resolveFieldDef(domain.collections[collection].schema()[linkField]);
  },

  /**
   * Схема коллекции для updateField в контексте задачи (вложенный phoneList и т.п.).
   * linkField — имя связи у родителя (phoneList / phoneListExtra), иначе берётся первое совпадение по collection.
   */
  resolveUpdateSchema({ collection, taskType, schemaPath = [], linkField }) {
    const col = String(collection || '').trim();
    const typeKey = String(taskType || '').trim();
    if (!typeKey || !col) return domain.collections[col]?.schema?.() || {};

    const segments = Array.isArray(schemaPath) ? schemaPath.map((k) => String(k).trim()).filter(Boolean) : [];
    let currentSchema = domain.collections.task[typeKey].schema();

    for (const key of segments) {
      const def = this.resolveFieldDef(currentSchema[key]);
      if (!def?.collection) return domain.collections[col].schema();
      currentSchema = this.schemaForLinkField(def, def.collection);
    }

    const linkKey = String(linkField || '').trim();
    if (linkKey && linkKey in currentSchema) {
      const def = this.resolveFieldDef(currentSchema[linkKey]);
      if (def?.collection === col) {
        return this.schemaForLinkField(def, col);
      }
    }

    for (const fieldDef of Object.values(currentSchema)) {
      const resolved = this.resolveFieldDef(fieldDef);
      if (resolved?.collection === col) {
        return this.schemaForLinkField(fieldDef, col);
      }
    }

    return domain.collections[col].schema();
  },

  schemaForLinkField(fieldDef, nestedColl) {
    const resolved = this.resolveFieldDef(fieldDef);
    if (!resolved?.collection) {
      return domain.collections[nestedColl].schema();
    }
    if (resolved.schema) {
      const nested = this.resolveSchema(resolved.schema);
      if (nested && typeof nested === 'object') return nested;
    }
    return domain.collections[nestedColl].schema();
  },

  mergeLstNamesFromSchema(nameSet, schema) {
    for (const fieldDef of Object.values(schema)) {
      const resolved = this.resolveFieldDef(fieldDef);
      if (resolved?.lst) nameSet.add(resolved.lst);
    }
  },

  getHiddenFieldsFromSchema(schema, viewer = null, accessContext = {}) {
    return domain.collections.utils.fieldAccess.getHiddenFieldsFromSchema(schema, viewer, accessContext);
  },

  pickDocumentForStore(doc, schema, viewer = null, accessContext = {}) {
    const out = { _id: String(doc._id) };
    if (doc.taskType !== undefined) out.taskType = doc.taskType;
    const fieldAccessContext = {
      ...accessContext,
      entityId: String(accessContext.entityId || doc._id || ''),
    };

    for (const [key, fieldDef] of Object.entries(schema)) {
      if (fieldDef === null || fieldDef === undefined) continue;

      const resolved = this.resolveFieldDef(fieldDef);
      if (resolved && typeof resolved === 'object' && resolved.collection) {
        const linkMap = doc[key];
        if (linkMap && typeof linkMap === 'object' && !Array.isArray(linkMap)) {
          out[key] = linkMap;
        }
        continue;
      }
      const fieldAccess = domain.collections.utils.fieldAccess;
      const fieldCtx = { ...fieldAccessContext, fieldName: key };
      if (fieldAccess.shouldOmitValueFromStore(fieldDef, viewer, fieldCtx)) continue;
      if (key in doc) out[key] = doc[key];
    }

    return out;
  },

  projectionFromSchema(schema) {
    const projection = { _id: 1 };
    for (const key of Object.keys(schema)) {
      projection[key] = 1;
    }
    return projection;
  },

  batchKey(nestedColl, schema) {
    return `${nestedColl}\x00${Object.keys(schema).sort().join('\x01')}`;
  },

  /**
   * Догружает связанную сущность и вложенности в storePatch (как getTask / updateLink add).
   * @returns {Record<string, unknown[]>} lst для ответа и core/updateLst
   */
  async appendLinkedTargetToStorePatch({
    storePatch,
    taskType,
    schemaPath = [],
    parentCollection,
    linkField,
    targetCollection,
    targetId,
    document,
    viewer = null,
  }) {
    const lstNameSet = new Set();
    if (!taskType || !parentCollection || !linkField || !targetCollection || !targetId) {
      return {};
    }

    const segments = Array.isArray(schemaPath) ? schemaPath : [];
    const linkFieldDef = this.resolveLinkFieldDef({
      taskType,
      collection: parentCollection,
      linkField,
      schemaPath: segments,
    });
    const nestedSchema = this.schemaForLinkField(linkFieldDef, targetCollection);
    const projection = this.projectionFromSchema(nestedSchema);

    let doc = document;
    if (!doc) {
      doc = await db.mongodb.findOne(targetCollection, { _id: new npm.mongodb.ObjectId(targetId) }, { projection });
    }

    const outId = String(doc._id);
    const nestedAccessContext = { collection: targetCollection, entityId: outId };
    const linkedStore = {};
    linkedStore[targetCollection] = {
      [outId]: {
        ...this.pickDocumentForStore(doc, nestedSchema, viewer, nestedAccessContext),
        ...this.getHiddenFieldsFromSchema(nestedSchema, viewer, nestedAccessContext),
      },
    };

    await domain.collections.utils.expandLinkedChain({
      store: linkedStore,
      fetchedEntity: new Set(),
      lstNameSet,
      collectionName: targetCollection,
      documents: [doc],
      schema: nestedSchema,
      viewer,
    });

    for (const [coll, byId] of Object.entries(linkedStore)) {
      if (!storePatch[coll]) storePatch[coll] = {};
      Object.assign(storePatch[coll], byId);
    }

    return Object.fromEntries([...lstNameSet].map((name) => [name, domain.lst[name].items]));
  },
});
