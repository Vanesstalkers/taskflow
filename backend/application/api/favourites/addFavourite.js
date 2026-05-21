({
  access: 'public',
  method: async ({ title, icon, targetKind, targetCollection, targetId }) => {
    const userId = context.session.state.userId;
    const resolvedTargetId = targetKind === 'registry' ? 'list' : targetId;

    const existing = await db.mongodb.findOne('favourite', {
      userId,
      targetCollection,
      targetId: resolvedTargetId,
    });
    if (existing) {
      const favId = String(existing._id);
      return {
        status: 'ok',
        favourite: {
          _id: favId,
          title: existing.title,
          icon: existing.icon,
          userId,
          targetKind: existing.targetKind,
          targetCollection,
          targetId: resolvedTargetId,
        },
        duplicate: true,
      };
    }

    const defaultIcon = {
      registry: 'mdi-database-search-outline',
      task: 'mdi-clipboard-text-outline',
      entity: 'mdi-bookmark-outline',
    }[targetKind];

    const now = new Date();
    const document = {
      title: title || 'Избранное',
      icon: icon || defaultIcon,
      userId,
      targetKind,
      targetCollection,
      targetId: resolvedTargetId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.mongodb.insertOne('favourite', document);
    const _id = String(result.insertedId);
    const favourite = { _id, ...document };

    context.client.emit('core/updateStore', {
      favourite: { [_id]: favourite },
    });

    return { status: 'ok', favourite, duplicate: false };
  },
});
