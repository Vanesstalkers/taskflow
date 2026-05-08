({
  access: 'public',
  parameters: {
    key: 'string',
    value: 'string',
  },
  method: async ({ key, value }) => {
    const result = await db.mongodb.insertOne('example', {
      key,
      value,
      createdAt: new Date(),
    });
    return {
      acknowledged: result.acknowledged,
      insertedId: String(result.insertedId),
    };
  },
});
