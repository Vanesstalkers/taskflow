({
  access: 'public',
  method: async ({ token }) => {
    const buildUser = async (accountId) => {
      if (!accountId) return null;
      const user = await api.auth.provider.getUserByAccountId(accountId);
      if (!user) return null;
      return {
        accountId: String(user.accountId || ''),
        login: user.login || '',
        fullName: user.fullName || '',
      };
    };

    const restored = context.client.restoreSession(token);
    if (restored) {
      const user = await buildUser(context.session?.accountId);
      return { status: 'logged', user };
    }
    const data = await api.auth.provider.readSession(token);
    if (!data) return { status: 'not logged' };
    try {
      const sessionData = typeof data === 'string' ? JSON.parse(data) : data;
      context.client.startSession(token, sessionData);
      const user = await buildUser(sessionData?.accountId);
      return { status: 'logged', user };
    } catch {
      return { status: 'not logged' };
    }
  },
});
