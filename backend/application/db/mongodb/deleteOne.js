async (collection, query, options) => {
  const database = await db.mongodb.connect();
  return database.collection(collection).deleteOne(query, options);
};
