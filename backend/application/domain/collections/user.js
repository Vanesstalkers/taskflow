({
  /** Поля MongoDB для текстового поиска (`api.core.search`, коллекция `user`) */
  searchFields: ['login', 'fullName'],
  schema: {
    login: '',
    password: {
      hidden: true,
      onUpdate: async (password) => await metarhia.metautil.hashPassword(password),
    },
  },
});
