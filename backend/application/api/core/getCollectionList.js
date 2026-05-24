({
  access: 'public',
  method: async ({ collection, search = '', limit = 100 }) => {
    const def = domain.collections[collection];
    const fields = domain.collections.utils.searchConfig.fields(def);

    const schema = def.schema();
    const viewer = await domain.collections.utils.fieldAccess.loadViewer(context.session.state.userId);
    const columns = domain.collections.utils.listColumnsFromSchema(schema, viewer);

    const projection = { _id: 1 };
    for (const col of columns) projection[col.key] = 1;

    search = String(search)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const query =
      search.length >= 3
        ? {
            $or: fields.map((field) => ({
              [field]: { $regex: search, $options: 'i' },
            })),
          }
        : {};

    // TODO: add access control (by user role)
    const documents = await db.mongodb.find(collection, query, {
      projection,
      limit,
      sort: { updatedAt: -1, createdAt: -1, _id: -1 },
    });

    const lstNameSet = new Set(columns.filter((c) => c.lst).map((c) => c.lst));
    const lst = Object.fromEntries([...lstNameSet].map((name) => [name, domain.lst[name]?.items || []]));

    const formatCell = (value, lstName) => {
      if (value === null || value === undefined) return '';
      if (lstName && domain.lst[lstName]) {
        const code = String(value);
        const item = domain.lst[lstName].items.find((i) => String(i.code) === code);
        if (item?.title) return String(item.title);
      }
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    };

    const rows = documents.map((document) => {
      const _id = String(document._id);
      const cells = {};
      const rawCells = {};
      for (const col of columns) {
        const raw = document[col.key];
        rawCells[col.key] = raw === null || raw === undefined ? '' : raw;
        cells[col.key] = formatCell(raw, col.lst);
      }
      const title = domain.collections.utils.searchItemTitle.fromDocument(collection, document);
      return { _id, title, cells, rawCells };
    });

    return {
      collection,
      title: def.title || collection,
      columns,
      rows,
      lst,
      fields,
    };
  },
});
