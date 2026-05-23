({
  schema: () => ({
    ...domain.task.defaultSchema,
    createdEmployeeLinks: {
      collection: 'employee',
      schema: {
        ...domain.collections.employee.schema(),
        manager: () => {
          const manager = domain.collections.employee.schema().manager;
          manager.schema.pp = Object.fromEntries(
            Object.entries(domain.collections.pp.schema()).filter(([key]) =>
              ['firstName', 'lastName', 'middleName', 'phoneList'].includes(key),
            ),
          );
          return manager;
        },
      },
    },
  }),
});
