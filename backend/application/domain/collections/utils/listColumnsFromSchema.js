(schema) => {
  const columns = [];
  for (const [key, def] of Object.entries(schema)) {
    if (def.hidden || def.collection) continue;
    columns.push({ key, lst: def.lst || null });
  }
  return columns;
};
