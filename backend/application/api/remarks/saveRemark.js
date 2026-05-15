({
  access: 'public',
  method: async ({ comment, devId, partialDevId, route, ui, domain, context: pageContext }) => {
    const text = String(comment ?? '').trim();
    if (!text) {
      return { status: 'error', error: 'empty_comment', message: 'Комментарий не может быть пустым' };
    }

    const userId = String(context.session.state.userId || '').trim();
    if (!userId) {
      return { status: 'error', error: 'unauthorized', message: 'Требуется авторизация' };
    }

    const document = {
      comment: text,
      devId: String(devId ?? '').trim(),
      partialDevId: String(partialDevId ?? '').trim(),
      route: String(route ?? '').trim(),
      ui: ui && typeof ui === 'object' && !Array.isArray(ui) ? ui : {},
      domain: domain && typeof domain === 'object' && !Array.isArray(domain) ? domain : {},
      context:
        pageContext && typeof pageContext === 'object' && !Array.isArray(pageContext) ? pageContext : {},
      status: 'new',
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedAt: null,
      resubmittedAt: null,
      completedAt: null,
    };

    const result = await db.mongodb.insertOne('remark', document);
    return { status: 'ok', _id: String(result.insertedId) };
  },
});
