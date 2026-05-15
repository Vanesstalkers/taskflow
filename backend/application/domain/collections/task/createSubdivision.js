({
  schema: () => ({
    ...domain.task.defaultSchema,
    createdSubdivisionLinks: {
      collection: 'subdivision',
      schema: domain.collections.subdivision.schema(),
    },
  }),
});
