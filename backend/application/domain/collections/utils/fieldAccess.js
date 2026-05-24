({
  resolveFieldDef(def) {
    return domain.collections.utils.linkSchema.resolveFieldDef(def);
  },

  async loadViewer(userId) {
    const id = String(userId || '').trim();
    if (!id) return null;
    try {
      const user = await db.mongodb.findOne('user', {
        _id: new npm.mongodb.ObjectId(id),
      });
      if (!user) return null;
      return this.buildViewer(user);
    } catch {
      return null;
    }
  },

  async buildViewer(user) {
    if (!user) return null;
    const roles = await this.loadUserRoleCodes(user);
    return {
      ...user,
      _id: String(user._id),
      roles,
    };
  },

  async loadUserRoleCodes(user) {
    const codes = [];
    const linkMap = user.userRoleList;
    if (!linkMap || typeof linkMap !== 'object') return codes;
    for (const roleId of Object.keys(linkMap)) {
      try {
        const roleDoc = await db.mongodb.findOne('userRole', {
          _id: new npm.mongodb.ObjectId(roleId),
        });
        if (roleDoc?.type) codes.push(String(roleDoc.type));
      } catch {
        // невалидный id связи — пропускаем
      }
    }
    return codes;
  },

  /**
   * @returns {'write'|'readonly'|'hidden'}
   */
  resolveAccessLevel(fieldDef, viewer, accessContext = {}) {
    const resolved = this.resolveFieldDef(fieldDef);
    if (!resolved || typeof resolved !== 'object') return 'write';
    if (resolved.hidden) return 'hidden';
    if (typeof resolved.access !== 'function') return 'write';
    try {
      const result = resolved.access(viewer, accessContext);
      if (result === true) return 'write';
      if (result === 'readonly') return 'readonly';
      return 'hidden';
    } catch {
      return 'hidden';
    }
  },

  isFieldHidden(fieldDef, viewer, accessContext = {}) {
    return this.resolveAccessLevel(fieldDef, viewer, accessContext) === 'hidden';
  },

  isFieldReadonly(fieldDef, viewer, accessContext = {}) {
    return this.resolveAccessLevel(fieldDef, viewer, accessContext) === 'readonly';
  },

  canWriteField(fieldDef, viewer, accessContext = {}) {
    return this.resolveAccessLevel(fieldDef, viewer, accessContext) === 'write';
  },

  getSchemaAccessMap(schema, viewer, accessContext = {}) {
    return Object.fromEntries(
      Object.entries(schema).map(([key, fieldDef]) => [
        key,
        this.resolveAccessLevel(fieldDef, viewer, { ...accessContext, fieldName: key }),
      ]),
    );
  },

  resolveLinkFieldDef({ collection, linkField, taskType, schemaPath = [] }) {
    const linkSchema = domain.collections.utils.linkSchema;
    const segments = Array.isArray(schemaPath) ? schemaPath : [];
    if (taskType) {
      return linkSchema.resolveLinkFieldDef({
        taskType,
        collection,
        linkField,
        schemaPath: segments,
      });
    }
    const parentSchema = domain.collections[collection]?.schema?.();
    if (!parentSchema) return null;
    return parentSchema[linkField];
  },

  /**
   * Контекст для access() связи: только данные из запроса (linkDocument с фронта / addObject).
   * @returns {{ action?: string, linkDocument?: object, targetId?: string }}
   */
  resolveLinkAccessContext({ targetId, linkDocument, action }) {
    const out = { action };
    if (linkDocument && typeof linkDocument === 'object' && !Array.isArray(linkDocument)) {
      out.linkDocument = linkDocument;
    }
    if (targetId) out.targetId = String(targetId);
    return out;
  },

  async assertLinkWritable({
    collection,
    _id,
    linkField,
    taskType,
    schemaPath,
    viewer,
    action,
    targetId,
    linkDocument,
  }) {
    const fieldDef = this.resolveLinkFieldDef({
      collection,
      linkField,
      taskType,
      schemaPath,
    });
    const linkAccess = this.resolveLinkAccessContext({
      targetId,
      linkDocument,
      action,
    });
    const accessContext = {
      collection,
      entityId: String(_id || '').trim(),
      fieldName: linkField,
      ...linkAccess,
    };
    if (!this.canWriteField(fieldDef, viewer, accessContext)) {
      throw new Error(`Нет доступа к связи: ${linkField}`, { code: 403 });
    }
  },

  shouldOmitValueFromStore(fieldDef, key) {
    if (key === 'password') return true;
    const resolved = this.resolveFieldDef(fieldDef);
    return typeof resolved?.onUpdate === 'function';
  },

  getHiddenFieldsFromSchema(schema, viewer, accessContext = {}) {
    return Object.fromEntries(
      Object.entries(schema)
        .map(([key, fieldDef]) =>
          this.isFieldHidden(fieldDef, viewer, { ...accessContext, fieldName: key }) ? [key, null] : null,
        )
        .filter(Boolean),
    );
  },

  async getHiddenFields({
    collection,
    taskType,
    viewer = null,
    viewerUserId = null,
    accessContext = {},
  }) {
    const schema =
      (taskType ? domain.collections.task[taskType].schema() : domain.collections[collection].schema()) || {};
    const resolvedViewer = viewer || (await this.loadViewer(viewerUserId));
    return this.getHiddenFieldsFromSchema(schema, resolvedViewer, {
      collection,
      ...accessContext,
    });
  },

  assertFieldsWritable(schema, data, viewer, accessContext = {}) {
    for (const fieldName of Object.keys(data)) {
      if (!this.canWriteField(schema[fieldName], viewer, { ...accessContext, fieldName })) {
        throw new Error(`Нет доступа к полю: ${fieldName}`, { code: 403 });
      }
    }
  },
});
