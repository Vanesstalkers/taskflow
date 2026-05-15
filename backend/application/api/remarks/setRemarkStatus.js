({
  access: 'public',
  method: async ({ _id, status }) => {
    const id = String(_id ?? '').trim();
    const next = domain.collections.utils.remarkStatus.toDocument(status);

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
    if (next === 'done' && current !== 'review') {
      return {
        status: 'error',
        error: 'invalid_transition',
        message: 'Статус «Готово» можно установить только из «На проверке»',
      };
    }

    const now = new Date();
    const patch = { status: next, updatedAt: now };
    if (next === 'done') patch.completedAt = now;

    const result = await db.mongodb.updateOne('remark', { _id: oid }, { $set: patch });
    if (result.matchedCount === 0) {
      return { status: 'error', error: 'not_found', message: 'Замечание не найдено' };
    }

    return { status: 'ok', _id: id, remarkStatus: next };
  },
});
