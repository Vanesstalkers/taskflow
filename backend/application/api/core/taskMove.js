({
  access: 'public',
  method: async ({ id, direction }) => {
    const result = await domain.task.move(id, direction);
    const { status, updatedAt } = result;

    context.client.emit('core/updateStore', {
      task: { [id]: { status, updatedAt } },
    });

    return { status: 'ok' };
  },
});
