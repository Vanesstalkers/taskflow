({
  access: 'public',
  method: async () => {
    const documents = await db.mongodb.find('task', {}, { sort: { createdAt: -1 } });
    const tasks = documents.map((document) => ({
      id: String(document._id),
      title: document.title || '',
      description: document.description || '',
      status: document.status || 'todo',
      createdAt: document.createdAt || null,
      updatedAt: document.updatedAt || null,
    }));
    return { tasks };
  },
});
