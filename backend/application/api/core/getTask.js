({
  access: 'public',
  method: async ({ _id }) => {
    const result = { error: null, store: {} };
    const lstNameSet = new Set();
    const fetchedEntity = new Set();

    const document = await db.mongodb.findOne('task', { _id: new npm.mongodb.ObjectId(_id) });
    const schema = domain.collections.task[document.taskType].schema();

    const task = { _id: String(document._id) };

    for (const [key, value] of Object.entries(schema)) {
      if (key in document) task[key] = document[key];
      if (value.collection && !task[key]) task[key] = {};
    }

    const viewer = await domain.collections.utils.fieldAccess.loadViewer(context.session.state.userId);

    await domain.collections.utils.expandLinkedChain({
      store: result.store,
      fetchedEntity,
      lstNameSet,
      collectionName: 'task',
      documents: [document],
      schema,
      viewer,
    });

    result.store.task = { [task._id]: task };
    result.lst = Object.fromEntries([...lstNameSet].map((name) => [name, domain.lst[name].items]));

    return result;
  },
});
