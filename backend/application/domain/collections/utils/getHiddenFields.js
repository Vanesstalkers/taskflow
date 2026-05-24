async ({ collection, taskType, viewer, viewerUserId, accessContext }) =>
  domain.collections.utils.fieldAccess.getHiddenFields({
    collection,
    taskType,
    viewer,
    viewerUserId,
    accessContext,
  });
