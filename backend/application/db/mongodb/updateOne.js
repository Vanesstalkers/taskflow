async (collection, query, update, options) => {
  const database = await db.mongodb.connect();
  return database.collection(collection).updateOne(query, update, options);
};
