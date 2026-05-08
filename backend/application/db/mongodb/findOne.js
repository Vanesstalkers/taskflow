async (collection, query, options) => {
  const database = await db.mongodb.connect();
  return database.collection(collection).findOne(query, options);
};
