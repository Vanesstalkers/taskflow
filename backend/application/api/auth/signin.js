({
  access: 'public',
  method: async ({ login, password }) => {
    const user = await api.auth.provider.getUser(login);
    if (!user) throw new Error('Incorrect login or password', { code: 401 });
    const { password: hash } = user;
    const valid = await metarhia.metautil.validatePassword(password, hash);
    if (!valid) throw new Error('Incorrect login or password', { code: 401 });
    const userId = String(user._id);
    console.log(`Logged user: ${login}`);
    const token = api.auth.provider.generateToken();
    const data = { userId };
    context.client.startSession(token, data);
    const { ip } = context.client;
    await api.auth.provider.createSession(token, data, { ip, userId });
    const payload = await api.auth.provider.buildUserPayload(user);
    return {
      status: 'logged',
      token,
      ...payload,
    };
  },
});
