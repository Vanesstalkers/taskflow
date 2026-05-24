async (collection, pipeline = []) => {
  const database = await db.mongodb.connect();
  return database.collection(collection).aggregate(pipeline).toArray();
};
