/**
 * Поиск по коллекции: `search.join` (aggregate) или find по `search.fields`.
 * @param {{ collection: string, search: string, limit: number }} params
 */
async ({ collection, search, limit }) => {
  const def = domain.collections[collection];
  const cfg = domain.collections.utils.searchConfig;
  const fields = cfg.fields(def);
  const cap = Math.max(1, Number(limit) || 20);

  const joinCfg = cfg.join(def);
  if (joinCfg?.linkField && joinCfg?.from) {
    const spec = domain.collections.utils.searchJoin.join({
      search,
      limit: cap,
      fields,
      ...joinCfg,
    });
    if (spec?.mode === 'aggregate' && Array.isArray(spec.pipeline)) {
      return db.mongodb.aggregate(collection, spec.pipeline);
    }
  }

  const projection = { _id: 1 };
  for (const field of fields) projection[field] = 1;

  const query = {
    $or: fields.map((field) => ({
      [field]: { $regex: search, $options: 'i' },
    })),
  };

  return db.mongodb.find(collection, query, { projection, limit: cap });
};
