async (collection, query = {}, options = {}) => {
  const database = await db.mongodb.connect();
  return database.collection(collection).find(query, options).toArray();
};
