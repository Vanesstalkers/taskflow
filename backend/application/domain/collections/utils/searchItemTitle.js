({
  fromDocument(collection, document) {
    const def = domain.collections[collection];
    if (typeof def?.formatSearchTitle === 'function') {
      return def.formatSearchTitle(document);
    }

    const searchFields = def?.searchFields;
    if (!Array.isArray(searchFields) || searchFields.length === 0) {
      return String(document._id);
    }

    const parts = searchFields
      .map((field) => document[field])
      .filter((v) => v !== null && String(v).trim() !== '');

    return parts.length > 0 ? parts.map((v) => String(v).trim()).join(' · ') : String(document._id);
  },
});
