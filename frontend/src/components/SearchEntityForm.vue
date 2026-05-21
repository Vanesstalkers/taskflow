<template>
  <v-card variant="outlined" class="search-entity-form pa-4">
    <div class="d-flex align-start justify-space-between mb-4 ga-2">
      <div>
        <h2 class="text-h6">{{ groupTitle }}</h2>
        <p class="text-body-2 text-medium-emphasis mt-1">
          {{ collection }} · <code class="text-caption">{{ entityId }}</code>
        </p>
      </div>
      <v-btn
        variant="tonal"
        size="small"
        prepend-icon="mdi-star-plus-outline"
        :loading="addingFavourite"
        @click="onAddToFavourites"
      >
        В избранное
      </v-btn>
    </div>

    <v-alert v-if="loadError" type="error" variant="tonal" density="compact" class="mb-4">
      {{ loadError }}
    </v-alert>
    <v-alert v-if="favouriteMessage" type="success" variant="tonal" density="compact" class="mb-4">
      {{ favouriteMessage }}
    </v-alert>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <template v-if="record">
      <v-row dense>
        <v-col v-for="row in fieldRows" :key="row.key" cols="12" sm="6">
          <v-text-field
            :model-value="row.display"
            :label="row.key"
            variant="outlined"
            density="compact"
            readonly
            hide-details
          />
        </v-col>
      </v-row>
      <p v-if="fieldRows.length === 0" class="text-body-2 text-medium-emphasis">Нет полей для отображения</p>
    </template>

    <p v-else-if="!loading && !loadError" class="text-body-2 text-medium-emphasis">
      Объект не найден в store. Выберите его снова из поиска.
    </p>
  </v-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { getApi } from '../main.js';
import { useStore } from '../stores/store.js';
import { addFavourite } from '../utils/favouriteActions.js';

const props = defineProps({
  collection: { type: String, required: true },
  entityId: { type: String, required: true },
  groupTitle: { type: String, default: '' },
  tabType: { type: String, default: 'entity' },
});

const globalStore = useStore();
const emit = defineEmits(['favourite-added']);

const loading = ref(false);
const loadError = ref('');
const addingFavourite = ref(false);
const favouriteMessage = ref('');

const record = computed(() => {
  const bucket = globalStore.store[props.collection];
  if (!bucket) return null;
  return bucket[props.entityId] || null;
});

const fieldRows = computed(() => {
  const doc = record.value;
  if (!doc || typeof doc !== 'object') return [];
  return Object.entries(doc)
    .filter(([key]) => key !== '_id')
    .map(([key, value]) => ({
      key,
      display: formatFieldValue(value),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
});

function formatFieldValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

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
  const title =
    String(record.value?.title || record.value?.login || record.value?.name || '').trim() ||
    String(props.groupTitle || '').trim() ||
    id;
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
</script>

<style scoped>
.search-entity-form {
  max-width: 960px;
}
</style>
