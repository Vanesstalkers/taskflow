({
  usersCollection: 'user',
  sessionsCollection: 'session',

  generateToken() {
    const { characters, secret, length } = config.sessions;
    return metarhia.metautil.generateToken(secret, characters, length);
  },

  async saveSession(token, data) {
    await db.mongodb.updateOne(
      api.auth.provider.sessionsCollection,
      { token },
      { $set: { data: JSON.stringify(data), updatedAt: new Date() } },
      { upsert: true },
    );
  },

  async createSession(token, data, fields = {}) {
    const now = new Date();
    return db.mongodb.insertOne(api.auth.provider.sessionsCollection, {
      token,
      data: JSON.stringify(data),
      ...fields,
      createdAt: now,
      updatedAt: now,
    });
  },

  async readSession(token) {
    const record = await db.mongodb.findOne(
      api.auth.provider.sessionsCollection,
      { token },
      { projection: { data: 1 } },
    );
    if (record && record.data) return record.data;
    return null;
  },

  async deleteSession(token) {
    return db.mongodb.deleteOne(api.auth.provider.sessionsCollection, { token });
  },

  async registerUser(login, password) {
    const existing = await api.auth.provider.getUser(login);
    if (existing) {
      throw new Error('User already exists', { code: 400 });
    }
    const now = new Date();
    const result = await db.mongodb.insertOne(api.auth.provider.usersCollection, {
      login,
      password,
      createdAt: now,
      updatedAt: now,
    });
    return { userId: String(result.insertedId) };
  },

  async getUser(login) {
    return db.mongodb.findOne(api.auth.provider.usersCollection, { login });
  },

  async getUserByUserId(userId) {
    try {
      return db.mongodb.findOne(api.auth.provider.usersCollection, {
        _id: new npm.mongodb.ObjectId(String(userId)),
      });
    } catch {
      return null;
    }
  },

  async buildUserPayload(user) {
    if (!user) return null;

    const linkSchema = domain.collections.utils.linkSchema;
    const viewer = await domain.collections.utils.fieldAccess.buildViewer(user);
    const userSchema = domain.collections.user.schema();
    const userId = String(user._id || '');
    const accessContext = { collection: 'user', entityId: userId };
    const picked = linkSchema.pickDocumentForStore(user, userSchema, viewer, accessContext);
    const ppLink = picked.pp && typeof picked.pp === 'object' ? picked.pp : {};
    const ppSchema = domain.collections.pp.schema();
    const pp = {};
    const ppStore = {};

    for (const ppId of Object.keys(ppLink)) {
      pp[ppId] = {};
      try {
        const ppDoc = await db.mongodb.findOne('pp', {
          _id: new npm.mongodb.ObjectId(ppId),
        });
        if (ppDoc) ppStore[ppId] = linkSchema.pickDocumentForStore(ppDoc, ppSchema, viewer);
      } catch {
        // связь есть, документ не загрузился — в store.pp не добавляем
      }
    }

    return {
      user: {
        _id: String(user._id || ''),
        login: user.login || '',
        pp,
      },
      store: Object.keys(ppStore).length > 0 ? { pp: ppStore } : {},
    };
  },
});
