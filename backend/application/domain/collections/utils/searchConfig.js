/** Конфиг поиска коллекции: `def.search`. */
({
  fields(def) {
    const fields = def?.search?.fields;
    return Array.isArray(fields) ? fields : [];
  },

  title(def) {
    return typeof def?.search?.title === 'function' ? def.search.title : null;
  },

  join(def) {
    const join = def?.search?.join;
    return join && typeof join === 'object' ? join : null;
  },

  enabled(def) {
    return this.fields(def).length > 0;
  },
});
