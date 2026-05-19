({
  title: 'Телефоны',
  searchFields: ['number'],
  schema: () => ({
    number: '',
    phoneType: { lst: 'phoneTypes' },
  }),
});
