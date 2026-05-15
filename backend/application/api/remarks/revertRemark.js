({
  access: 'public',
  method: async ({ _id, comment }) => {
    const id = String(_id ?? '').trim();
    if (!id) {
      return { status: 'error', error: 'empty_id', message: 'Не указан идентификатор замечания' };
    }

    const userId = String(context.session.state.userId || '').trim();
    if (!userId) {
      return { status: 'error', error: 'unauthorized', message: 'Требуется авторизация' };
    }

    const oid = new npm.mongodb.ObjectId(id);
    const existing = await db.mongodb.findOne('remark', { _id: oid });
    if (!existing) {
      return { status: 'error', error: 'not_found', message: 'Замечание не найдено' };
    }

    const current = domain.collections.utils.remarkStatus.normalize(existing.status);
    if (current !== 'review') {
      return {
        status: 'error',
        error: 'invalid_status',
        message: 'Откат доступен только для статуса «На проверке»',
      };
    }

    const note = String(comment ?? '').trim();
    const prefix = 'ВЕРНУТЬ КАК БЫЛО: откатить правки по этому замечанию.';
    const text = note ? `${prefix}\n\n${note}` : prefix;

    const now = new Date();
    const result = await db.mongodb.updateOne(
      'remark',
      { _id: oid },
      {
        $set: {
          comment: text,
          status: 'new',
          revertRequested: true,
          updatedAt: now,
          revertedAt: now,
          resubmittedAt: now,
        },
      },
    );

    if (result.matchedCount === 0) {
      return { status: 'error', error: 'not_found', message: 'Замечание не найдено' };
    }

    return { status: 'ok', _id: id };
  },
});
