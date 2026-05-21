({
  title: 'Телефоны',
  searchFields: ['code', 'number'],
  formatSearchTitle: (document) => domain.collections.utils.phoneFormat.formatDisplay(document),
  schema: () => ({
    code: {
      onUpdate: async (value) => String(value ?? '').replace(/\D/g, '').slice(0, 4),
    },
    number: {
      onUpdate: async (value) => String(value ?? '').replace(/\D/g, '').slice(0, 10),
    },
    phoneType: { lst: 'phoneTypes' },
  }),
});
