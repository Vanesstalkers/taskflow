({
  title: 'Подразделения',
  search: {
    fields: ['name'],
  },
  schema: () => ({
    name: '',
    description: '',
    phoneList: {
      collection: 'phone',
      schema: () => {
        const phoneSchema = domain.collections.phone.schema();
        return {
          ...phoneSchema,
          active: {
            access: (viewer) => (viewer?.roles?.includes('admin') ? 'readonly' : true),
          },
        };
      },
    },
    phoneListExtra: {
      collection: 'phone',
      schema: domain.collections.phone.schema(),
    },
  }),
});
