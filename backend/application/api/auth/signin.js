({
  access: 'public',
  method: async ({ login, password }) => {
    const user = await api.auth.provider.getUser(login);
    if (!user) throw new Error('Incorrect login or password');
    const { userId, password: hash } = user;
    const valid = await metarhia.metautil.validatePassword(password, hash);
    if (!valid) throw new Error('Incorrect login or password');
    console.log(`Logged user: ${login}`);
    const token = api.auth.provider.generateToken();
    const data = { userId: user.userId };
    context.client.startSession(token, data);
    const { ip } = context.client;
    await api.auth.provider.createSession(token, data, { ip, userId });
    return {
      status: 'logged',
      token,
      user: {
        userId: String(user.userId),
        login: user.login || '',
        fullName: user.fullName || '',
      },
    };
  },
});
