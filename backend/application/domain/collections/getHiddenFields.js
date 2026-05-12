(collection) =>
  Object.fromEntries(
    Object.entries(domain.collections[collection].schema() || {})
      .map(([key, value]) => (value.hidden ? [key, null] : null))
      .filter(Boolean),
  );
