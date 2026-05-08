({
  access: 'public',
  parameters: {
    key: 'string',
  },
  method: async ({ key }) => {
    const document = await db.mongodb.findOne('example', { key });
    if (!document) return { result: null };
    return {
      result: {
        id: String(document._id),
        key: document.key,
        value: document.value,
        createdAt: document.createdAt,
      },
    };
  },
});
