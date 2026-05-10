({
  schema: () => ({
    ...domain.task.defaultSchema,
    createdUserLinks: { collection: 'user', fields: ['login'] },
  }),
});
