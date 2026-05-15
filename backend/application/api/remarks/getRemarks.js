({
  access: 'public',
  method: async ({ limit, status } = {}) => {
    const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
    const query = {};

    if (status) {
      const normalized = domain.collections.utils.remarkStatus.normalize(status);
      if (normalized === 'new') {
        query.status = { $in: ['new', 'pending'] };
      } else if (normalized === 'done') {
        query.status = { $in: ['done', 'processed'] };
      } else {
        query.status = normalized;
      }
    }

    const documents = await db.mongodb.find('remark', query, {
      sort: { createdAt: -1 },
      limit: cap,
    });

    const remarks = documents
      .map((doc) => domain.collections.utils.remarkStatus.mapDoc(doc))
      .filter(Boolean);

    return { status: 'ok', remarks, count: remarks.length };
  },
});
