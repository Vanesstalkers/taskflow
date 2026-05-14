({
  searchFields: ['firstName', 'lastName'],
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
