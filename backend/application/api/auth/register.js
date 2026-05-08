({
  access: 'public',
  method: async ({ login, password, fullName }) => {
    const hash = await metarhia.metautil.hashPassword(password);
    const { accountId } = await api.auth.provider.registerUser(login, hash, fullName);
    const token = api.auth.provider.generateToken();
    const data = { accountId };
    context.client.startSession(token, data);
    const { ip } = context.client;
    await api.auth.provider.createSession(token, data, { ip, accountId });
    return {
      status: 'success',
      token,
      user: {
        accountId: String(accountId),
        login,
        fullName: fullName || '',
      },
    };
  },
});
