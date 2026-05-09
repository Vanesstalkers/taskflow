({
  access: 'public',
  method: async () => {
    const { uuid, session, client } = context;
    const { ip } = client;
    const { token, userId } = session;
    return { result: { ip, token, userId, uuid } };
  },
});
