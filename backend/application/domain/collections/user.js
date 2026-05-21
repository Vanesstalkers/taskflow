({
  title: 'Пользователи',
  searchFields: ['login'],
  uniqueKey: ['login'],
  schema: () => ({
    login: '',
    password: {
      hidden: true,
      onUpdate: async (value) => await metarhia.metautil.hashPassword(value),
    },
    userRoleList: {
      collection: 'userRole',
      schema: domain.collections.userRole.schema(),
    },
    ppList: {
      collection: 'pp',
      schema: domain.collections.pp.schema(),
    },
    workspaceTabs: {
      hidden: true,
    },
  }),
});
