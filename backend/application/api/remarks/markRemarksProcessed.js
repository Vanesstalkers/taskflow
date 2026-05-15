({
  access: 'public',
  method: async ({ ids }) => {
    const list = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
    const objectIds = list
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .map((id) => new npm.mongodb.ObjectId(id));

    if (objectIds.length === 0) {
      return { status: 'error', error: 'empty_ids', message: 'Не указаны идентификаторы замечаний' };
    }

    const reviewedAt = new Date();
    let modified = 0;
    for (const _id of objectIds) {
      const result = await db.mongodb.updateOne(
        'remark',
        { _id },
        { $set: { status: 'review', reviewedAt, updatedAt: reviewedAt } },
      );
      modified += result.modifiedCount || 0;
    }

    return { status: 'ok', modified };
  },
});
