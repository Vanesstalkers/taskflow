({
  title: 'Физлица',
  search: {
    fields: ['firstName', 'lastName', 'middleName'],
    title(document) {
      const parts = ['lastName', 'firstName', 'middleName']
        .map((field) => String(document[field] ?? '').trim())
        .filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : String(document._id);
    },
  },
  schema: () => ({
    firstName: '',
    lastName: '',
    middleName: '',
    birthDate: '',
    gender: { lst: 'genders' },
    phoneList: {
      collection: 'phone',
      schema: domain.collections.phone.schema(),
    },
  }),
});
