({
  statuses: ['todo', 'inProgress', 'done'],

  defaultSchema: {
    _id: '',
    title: '',
    description: '',
    taskType: { lst: 'taskTypes' },
    status: '',
    userLinks: { collection: 'user' },
    docLinks: { collection: 'doc', schema: domain.collections.doc.schema() },
  },

  async move(id, direction) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('Parameter "id" must be a non-empty string');
    }
    if (direction !== 'forward' && direction !== 'backward') {
      throw new Error('Parameter "direction" must be "forward" or "backward"');
    }

    const _id = new npm.mongodb.ObjectId(id);
    const document = await db.mongodb.findOne('task', { _id });
    if (!document) {
      throw new Error('Object not found');
    }

    const currentStatus = document.status || 'todo';
    const currentIndex = domain.task.statuses.indexOf(currentStatus);
    const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;
    const step = direction === 'forward' ? 1 : -1;
    const nextIndex = safeCurrentIndex + step;

    if (nextIndex < 0 || nextIndex >= domain.task.statuses.length) {
      return {
        id,
        status: currentStatus,
        updatedAt: document.updatedAt || null,
        changed: false,
      };
    }

    const status = domain.task.statuses[nextIndex];
    const updatedAt = new Date();
    await db.mongodb.updateOne('task', { _id }, { $set: { status, updatedAt } });
    return { id, status, updatedAt, changed: true };
  },
});
