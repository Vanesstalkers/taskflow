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
      /** store/getEntity: hidden (значение не уходит на фронт); intent write — право смены пароля */
      access: (viewer, { entityId, intent } = {}) => {
        const canEdit =
          viewer?.roles?.includes('admin') ||
          (() => {
            const targetId = String(entityId || '').trim();
            const viewerId = String(viewer?._id || '').trim();
            return targetId.length > 0 && targetId === viewerId;
          })();
        if (intent === 'write') return !!canEdit;
        return false;
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
