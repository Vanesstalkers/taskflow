({
  searchFields: ['login'],
  /** Поля, которые не должны повторяться между документами (`addObject`, `updateField`). */
  uniqueKey: ['login', 'password'],
  schema: () => ({
    login: '',
    password: {
      hidden: true,
      onUpdate: async (password) => await metarhia.metautil.hashPassword(password),
    },
    userRoleList: { collection: 'userRole', schema: domain.collections.userRole.schema() },
  }),
});
