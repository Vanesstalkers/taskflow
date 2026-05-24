import { computed, onMounted, ref, watch } from 'vue';
import { getApi } from '../main.js';
import { useStore } from '../stores/store.js';
import { addFavourite } from '../utils/favouriteActions.js';

/**
 * Общая логика карточки сущности (store, загрузка task, избранное).
 * @param {import('vue').Ref|object} props — collection, entityId, groupTitle, tabType
 * @param {(event: string, ...args: unknown[]) => void} emit
 */
export function useEntityView(props, emit) {
  const globalStore = useStore();

  const loading = ref(false);
  const loadError = ref('');
  const addingFavourite = ref(false);
  const favouriteMessage = ref('');

  const record = computed(() => {
    const bucket = globalStore.store[props.collection];
    if (!bucket) return null;
    return bucket[props.entityId] || null;
  });

  const displayTitle = computed(() => {
    const doc = record.value;
    if (!doc) return String(props.groupTitle || props.collection || '');
    return (
      String(doc.title || doc.login || doc.name || '').trim() ||
      String(props.groupTitle || '').trim() ||
      props.entityId
    );
  });

  async function loadTaskIfNeeded() {
    if (props.collection !== 'task' || props.tabType !== 'task') return;
    const getTask = getApi()?.core?.getTask;
    const id = String(props.entityId || '').trim();
    if (!getTask || !id) return;

    loading.value = true;
    loadError.value = '';
    try {
      const res = await getTask({ _id: id });
      if (res?.error) {
        loadError.value =
          res.error === 'not_found' ? 'Задача не найдена или нет доступа' : 'Не удалось загрузить задачу';
        return;
      }
      const patch = res?.store;
      if (patch && typeof patch === 'object') {
        globalStore.setData({ lst: res.lst || {}, store: patch });
      }
    } catch (error) {
      loadError.value = error.message || 'Не удалось загрузить задачу';
    } finally {
      loading.value = false;
    }
  }

  async function onAddToFavourites() {
    const id = String(props.entityId || '').trim();
    if (!id) return;
    const targetKind = props.tabType === 'task' || props.collection === 'task' ? 'task' : 'entity';
    const title = displayTitle.value;
    addingFavourite.value = true;
    favouriteMessage.value = '';
    try {
      const res = await addFavourite({
        title,
        icon: targetKind === 'task' ? 'mdi-clipboard-text-outline' : 'mdi-bookmark-outline',
        targetKind,
        targetCollection: props.collection,
        targetId: id,
      });
      favouriteMessage.value = res.duplicate ? 'Уже в избранном' : 'Добавлено в избранное';
      emit('favourite-added', res.favourite);
    } catch (error) {
      loadError.value = error.message || 'Не удалось добавить в избранное';
    } finally {
      addingFavourite.value = false;
    }
  }

  onMounted(() => {
    void loadTaskIfNeeded();
  });

  watch(
    () => props.entityId,
    () => {
      void loadTaskIfNeeded();
    },
  );

  return {
    loading,
    loadError,
    addingFavourite,
    favouriteMessage,
    record,
    displayTitle,
    onAddToFavourites,
    loadTaskIfNeeded,
  };
}

export function formatEntityFieldValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
