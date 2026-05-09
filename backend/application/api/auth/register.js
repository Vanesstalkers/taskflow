({
  access: 'public',
  method: async ({ login, password, fullName }) => {
    const hash = await metarhia.metautil.hashPassword(password);
    const { userId } = await api.auth.provider.registerUser(login, hash, fullName);
    const token = api.auth.provider.generateToken();
    const data = { userId };
    context.client.startSession(token, data);
    const { ip } = context.client;
    await api.auth.provider.createSession(token, data, { ip, userId });
    return {
      status: 'success',
      token,
      user: {
        userId: String(userId),
        login,
        fullName: fullName || '',
      },
    };
  },
});
