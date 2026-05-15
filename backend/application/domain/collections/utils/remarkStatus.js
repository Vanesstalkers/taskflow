({
  STATUSES: ['new', 'review', 'done'],

  normalize(raw) {
    const s = String(raw || '').trim();
    if (s === 'pending') return 'new';
    if (s === 'processed') return 'done';
    if (s === 'new' || s === 'review' || s === 'done') return s;
    return 'new';
  },

  toDocument(status) {
    const s = this.normalize(status);
    if (!this.STATUSES.includes(s)) {
      throw new Error(`Invalid remark status: ${status}`);
    }
    return s;
  },

  mapDoc(doc) {
    if (!doc) return null;
    const status = this.normalize(doc.status);
    return {
      _id: String(doc._id),
      comment: doc.comment || '',
      devId: doc.devId || '',
      partialDevId: doc.partialDevId || '',
      route: doc.route || '',
      ui: doc.ui || {},
      domain: doc.domain || {},
      context: doc.context || {},
      status,
      createdBy: doc.createdBy || '',
      createdAt: doc.createdAt || null,
      updatedAt: doc.updatedAt || null,
      reviewedAt: doc.reviewedAt || null,
      resubmittedAt: doc.resubmittedAt || null,
      revertedAt: doc.revertedAt || null,
      revertRequested: Boolean(doc.revertRequested),
      completedAt: doc.completedAt || doc.processedAt || null,
    };
  },
});
