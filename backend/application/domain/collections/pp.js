({
  searchFields: ['firstName', 'lastName'],
  schema: () => ({
    firstName: '',
    lastName: '',
    middleName: '',
    birthDate: '',
    gender: '',
    phoneList: {
      collection: 'phone',
      schema: domain.collections.phone.schema(),
    },
  }),
});
