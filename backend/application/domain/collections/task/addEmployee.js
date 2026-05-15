({
  schema: () => ({
    ...domain.task.defaultSchema,
    createdEmployeeLinks: {
      collection: 'employee',
      schema: domain.collections.employee.schema(),
    },
  }),
});
