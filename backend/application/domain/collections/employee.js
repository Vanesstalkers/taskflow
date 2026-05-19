({
  schema: () => ({
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
  }),
});
