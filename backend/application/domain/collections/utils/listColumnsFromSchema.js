(schema, viewer = null) => {
  const fieldAccess = domain.collections.utils.fieldAccess;
  const columns = [];
  for (const [key, def] of Object.entries(schema)) {
    const resolved = fieldAccess.resolveFieldDef(def);
    if (fieldAccess.isFieldHidden(def, viewer) || resolved?.collection) continue;
    columns.push({ key, lst: def.lst || null });
  }
  return columns;
};
