({
  title: 'Сотрудники',
  search: {
    fields: ['position'],
  },
  schema: ({ ignore = [] } = {}) => ({
    position: '',
    positionType: { lst: 'jobTitles' },
    subdivision: {
      collection: 'subdivision',
      schema: domain.collections.subdivision.schema(),
    },
    pp: {
      collection: 'pp',
      schema: domain.collections.pp.schema(),
    },
    manager: ignore.includes('manager')
      ? null
      : {
          collection: 'employee',
          schema: {
            ...domain.collections.employee.schema({ ignore: ['manager'] }),
          },
        },
  }),
});
