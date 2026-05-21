({
  access: 'public',
  method: async ({ _id }) => {
    await db.mongodb.deleteOne('favourite', { _id: new npm.mongodb.ObjectId(_id) });

    context.client.emit('core/updateStore', {
      favourite: { [_id]: null },
    });

    return { status: 'ok' };
  },
});
