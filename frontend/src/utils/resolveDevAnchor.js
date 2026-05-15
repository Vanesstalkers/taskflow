/**
 * Сопоставляет partialDevId из data-dev-id с записью manifest.
 * @param {object|null} manifest
 * @param {string} partialDevId
 * @param {string} [scopeHint] — taskType открытой задачи (addEmployee, …)
 */
export function resolveAnchorFromManifest(manifest, partialDevId, scopeHint = '') {
  const partial = String(partialDevId || '').trim();
  if (!partial || !manifest?.anchors) return null;

  const anchors = manifest.anchors;

  if (anchors[partial]) {
    return { devId: partial, anchor: anchors[partial] };
  }

  const hint = String(scopeHint || '').trim();

  if (partial.startsWith('link.')) {
    const linkMatches = Object.entries(anchors).filter(([, entry]) => {
      const d = entry?.domain;
      if (d?.kind !== 'link') return false;
      const suffix = `link.${d.parentCollection}.${d.linkField}`;
      return partial === suffix || partial.endsWith(`.${suffix}`);
    });
    if (linkMatches.length === 1) {
      const [devId, anchor] = linkMatches[0];
      return { devId, anchor };
    }
    if (linkMatches.length > 1 && hint) {
      const scoped = linkMatches.find(([devId]) => devId === hint || devId.startsWith(`${hint}.`));
      if (scoped) {
        const [devId, anchor] = scoped;
        return { devId, anchor };
      }
    }
    if (linkMatches.length > 0) {
      const [devId, anchor] = linkMatches[0];
      return { devId, anchor };
    }
  }

  const fieldMatches = Object.entries(anchors).filter(([, entry]) => {
    const d = entry?.domain;
    if (d?.kind === 'link') return false;
    if (!d?.collection || !d?.field) return false;
    return `${d.collection}.${d.field}` === partial;
  });

  if (fieldMatches.length === 0) return null;
  if (fieldMatches.length === 1) {
    const [devId, anchor] = fieldMatches[0];
    return { devId, anchor };
  }

  if (hint) {
    const scoped = fieldMatches.find(([devId]) => devId === hint || devId.startsWith(`${hint}.`));
    if (scoped) {
      const [devId, anchor] = scoped;
      return { devId, anchor };
    }
  }

  const [devId, anchor] = fieldMatches[0];
  return { devId, anchor };
}

export async function fetchDevAnchorManifest() {
  const res = await fetch('/dev-anchor-manifest.json', { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}
