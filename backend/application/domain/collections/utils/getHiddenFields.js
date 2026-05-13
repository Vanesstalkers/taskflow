({ collection, taskType }) => {
  const schema =
    (taskType ? domain.collections.task[taskType].schema() : domain.collections[collection].schema()) || {};

  return Object.fromEntries(
    Object.entries(schema)
      .map(([key, value]) => (value.hidden ? [key, null] : null))
      .filter(Boolean),
  );
};
