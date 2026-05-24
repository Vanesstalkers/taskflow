({
  schema: () => ({
    ...domain.task.defaultSchema,
    createdEmployeeLinks: {
      collection: 'employee',
      schema: {
        ...domain.collections.employee.schema(),
        manager: () => ({
          collection: 'employee',
          schema: {
            ...domain.collections.employee.schema({ ignore: ['manager'] }),
            pp: {
              collection: 'pp',
              schema: {
                ...Object.fromEntries(
                  Object.entries(domain.collections.pp.schema()).filter(([key]) =>
                    ['firstName', 'lastName', 'middleName'].includes(key),
                  ),
                ),
                phoneList: {
                  collection: 'phone',
                  schema: Object.fromEntries(
                    Object.entries(domain.collections.phone.schema()).filter(([key]) => key !== 'active'),
                  ),
                },
              },
            },
          },
        }),
      },
    },
  }),
});
