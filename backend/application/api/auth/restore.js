({
  access: 'public',
  method: async ({ token }) => {
    const buildUser = async (userId) => {
      if (!userId) return null;
      const user = await api.auth.provider.getUserByUserId(userId);
      if (!user) return null;
      return api.auth.provider.buildUserPayload(user);
    };

    const restored = context.client.restoreSession(token);
    if (restored) {
      const payload = await buildUser(context.session.state.userId);
      if (!payload) return { status: 'not logged' };
      return { status: 'logged', ...payload };
    }
    const data = await api.auth.provider.readSession(token);
    if (!data) return { status: 'not logged' };
    try {
      const sessionData = typeof data === 'string' ? JSON.parse(data) : data;
      context.client.startSession(token, sessionData);
      const payload = await buildUser(sessionData?.userId);
      if (!payload) return { status: 'not logged' };
      return { status: 'logged', ...payload };
    } catch {
      return { status: 'not logged' };
    }
  },
});
