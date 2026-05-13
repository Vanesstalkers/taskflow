({
  access: 'public',
  method: async ({ name }) => ({ items: domain.lst[name].items }),
});
