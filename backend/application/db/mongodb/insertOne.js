async (collection, document) => {
  const database = await db.mongodb.connect();
  return database.collection(collection).insertOne(document);
};
