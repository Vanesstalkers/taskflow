import { computed, unref } from 'vue';

/** Стабильный id для data-dev-id: явный devId или collection.field */
export function useDevAnchorId(props) {
  return computed(() => {
    const devId = unref(props)?.devId;
    if (devId) return String(devId);
    const collection = unref(props)?.collection;
    const field = unref(props)?.field;
    if (collection && field) return `${collection}.${field}`;
    return undefined;
  });
}
