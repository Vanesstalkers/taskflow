({
  access: 'public',
  method: async ({ limit } = {}) => {
    const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const documents = await db.mongodb.find(
      'remark',
      { status: { $in: ['new', 'pending'] } },
      { sort: { createdAt: -1 }, limit: cap },
    );

    const remarks = documents
      .map((doc) => domain.collections.utils.remarkStatus.mapDoc(doc))
      .filter(Boolean);

    return { status: 'ok', remarks, count: remarks.length };
  },
});
