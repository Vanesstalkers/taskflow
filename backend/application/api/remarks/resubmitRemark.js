({
  access: 'public',
  method: async ({ _id, comment }) => {
    const id = String(_id ?? '').trim();
    const text = String(comment ?? '').trim();
    if (!id) {
      return { status: 'error', error: 'empty_id', message: 'Не указан идентификатор замечания' };
    }
    if (!text) {
      return { status: 'error', error: 'empty_comment', message: 'Комментарий не может быть пустым' };
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
        message: 'Повторная отправка доступна только для статуса «На проверке»',
      };
    }

    const now = new Date();
    const result = await db.mongodb.updateOne(
      'remark',
      { _id: oid },
      {
        $set: {
          comment: text,
          status: 'new',
          revertRequested: false,
          updatedAt: now,
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
