let connecting = null;

async () => {
  if (db.mongodb.database) return db.mongodb.database;
  if (!connecting) {
    if (application.worker.id === 'W1') {
      console.debug('Connect to mongodb');
    }
    const client = new npm.mongodb.MongoClient(config.mongodb.uri);
    connecting = client.connect().then(() => {
      db.mongodb.client = client;
      db.mongodb.database = client.db(config.mongodb.database);
      return db.mongodb.database;
    });
  }
  return connecting;
};
