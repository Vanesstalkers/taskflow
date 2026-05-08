({
  usersCollection: 'account',
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

  async registerUser(login, password, fullName) {
    const existing = await api.auth.provider.getUser(login);
    if (existing) {
      throw new Error('User already exists');
    }
    const accountId = new npm.mongodb.ObjectId().toHexString();
    const now = new Date();
    await db.mongodb.insertOne(api.auth.provider.usersCollection, {
      accountId,
      login,
      password,
      fullName: fullName || '',
      createdAt: now,
      updatedAt: now,
    });
    return { accountId };
  },

  async getUser(login) {
    return db.mongodb.findOne(api.auth.provider.usersCollection, { login });
  },

  async getUserByAccountId(accountId) {
    return db.mongodb.findOne(api.auth.provider.usersCollection, { accountId: String(accountId) });
  },
});
