({
  access: 'public',
  method: async ({ token }) => {
    const buildUser = async (userId) => {
      if (!userId) return null;
      const user = await api.auth.provider.getUserByUserId(userId);
      if (!user) return null;
      return {
        userId: String(user._id || ''),
        login: user.login || '',
        fullName: user.fullName || '',
      };
    };

    const restored = context.client.restoreSession(token);
    if (restored) {
      const user = await buildUser(context.session.state.userId);
      return { status: 'logged', user };
    }
    const data = await api.auth.provider.readSession(token);
    if (!data) return { status: 'not logged' };
    try {
      const sessionData = typeof data === 'string' ? JSON.parse(data) : data;
      context.client.startSession(token, sessionData);
      const user = await buildUser(sessionData?.userId);
      return { status: 'logged', user };
    } catch {
      return { status: 'not logged' };
    }
  },
});
