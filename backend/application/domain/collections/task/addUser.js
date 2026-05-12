({
  schema: () => ({
    ...domain.task.defaultSchema,
    createdUserLinks: { collection: 'user', schema: domain.collections.user.schema() },
  }),
});
