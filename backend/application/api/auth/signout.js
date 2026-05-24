({
  access: 'public',
  method: async ({ token }) => {
    const sessionToken = String(token || '').trim();
    if (sessionToken) {
      await api.auth.provider.deleteSession(sessionToken);
    }
    return { status: 'ok' };
  },
});
