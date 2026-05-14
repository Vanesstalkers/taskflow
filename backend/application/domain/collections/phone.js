({
  searchFields: ['number'],
  schema: () => ({
    number: '',
    phoneType: { lst: 'phoneTypes' },
  }),
});
