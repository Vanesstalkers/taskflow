({
  fromDocument(collection, document) {
    const def = domain.collections[collection];
    const cfg = domain.collections.utils.searchConfig;
    const titleFn = cfg.title(def);
    if (titleFn) return titleFn(document);

    const fields = cfg.fields(def);
    if (fields.length === 0) {
      return String(document._id);
    }

    const parts = fields
      .map((field) => document[field])
      .filter((v) => v !== null && String(v).trim() !== '');

    return parts.length > 0 ? parts.map((v) => String(v).trim()).join(' · ') : String(document._id);
  },
});
