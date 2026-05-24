({
  title: 'Пользователи',
  uniqueKey: ['login'],

  search: {
    fields: ['login'],
    title(document) {
      const login = String(document.login ?? '').trim();
      const fio = String(document._fio ?? '').trim();
      if (login && fio) return `${login} (${fio})`;
      if (login) return login;
      if (fio) return fio;
      return String(document._id);
    },
    join: {
      linkField: 'pp',
      from: 'pp',
      enrichAs: '_fio',
      enrichParts: ['lastName', 'firstName', 'middleName'],
      matchFields: ['lastName', 'firstName', 'middleName'],
    },
  },

  schema: () => ({
    login: '',
    password: {
      access: (viewer, { entityId } = {}) => {
        if (viewer?.roles?.includes('admin')) return true;
        const targetId = String(entityId || '').trim();
        const viewerId = String(viewer?._id || '').trim();
        return targetId.length > 0 && targetId === viewerId;
      },
      onUpdate: async (value) => await metarhia.metautil.hashPassword(value),
    },
    userRoleList: {
      collection: 'userRole',
      schema: domain.collections.userRole.schema(),
      access: (viewer, { linkDocument } = {}) => {
        if (viewer?.roles?.includes('admin')) return true;
        const code = String(linkDocument?.type ?? '').trim();
        if (code && code !== 'admin') return true;
        return 'readonly';
      },
    },
    pp: {
      collection: 'pp',
      schema: domain.collections.pp.schema(),
    },
    workspaceTabs: {
      hidden: true,
    },
  }),
});
