({
  /**
   * Дерево прав доступа по схеме типа задачи (структура как в task.schema).
   * Связь → вложенный объект; скаляр → write | readonly | hidden.
   * @param {{ taskType: string, viewer?: object, entityId?: string }} params
   * @returns {Record<string, string | Record<string, unknown>>}
   */
  build({ taskType, viewer = null, entityId = '' }) {
    const typeKey = String(taskType || '').trim();
    if (!typeKey || !domain.collections.task[typeKey]) return {};

    const linkSchema = domain.collections.utils.linkSchema;
    const fieldAccess = domain.collections.utils.fieldAccess;

    const walk = (schema, accessContext) => {
      const out = {};
      const accessByField = fieldAccess.getSchemaAccessMap(schema, viewer, accessContext);

      for (const [key, fieldDef] of Object.entries(schema || {})) {
        if (fieldDef === null || fieldDef === undefined) continue;

        const resolved = linkSchema.resolveFieldDef(fieldDef);
        if (resolved?.collection) {
          const nestedSchema = linkSchema.schemaForLinkField(resolved, resolved.collection);
          out[key] = walk(nestedSchema, {
            collection: String(resolved.collection),
            entityId: accessContext.entityId,
          });
        } else {
          out[key] = accessByField[key];
        }
      }

      return out;
    };

    return walk(domain.collections.task[typeKey].schema(), {
      collection: 'task',
      entityId: String(entityId || '').trim(),
    });
  },
});
