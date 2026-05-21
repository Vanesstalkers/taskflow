<template>
  <v-card variant="outlined" class="entity-collection-list pa-4">
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
      <div>
        <h2 class="text-h6">{{ listTitle }}</h2>
        <p class="text-caption text-medium-emphasis mb-0">{{ collection }}</p>
      </div>
      <div class="d-flex ga-2 align-center flex-wrap">
        <v-text-field
          v-model="searchQuery"
          class="entity-collection-list__search"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          placeholder="Фильтр (от 3 символов)…"
          prepend-inner-icon="mdi-magnify"
          @update:model-value="onSearchInput"
        />
        <v-btn
          variant="tonal"
          size="small"
          prepend-icon="mdi-star-plus-outline"
          :loading="addingFavourite"
          @click="onAddRegistryToFavourites"
        >
          В избранное
        </v-btn>
      </div>
    </div>

    <v-alert v-if="errorText" type="error" variant="tonal" density="compact" class="mb-4">
      {{ errorText }}
    </v-alert>
    <v-alert v-if="favouriteMessage" type="success" variant="tonal" density="compact" class="mb-4">
      {{ favouriteMessage }}
    </v-alert>

    <v-data-table
      :headers="tableHeaders"
      :items="rows"
      :loading="loading"
      item-value="_id"
      density="compact"
      class="entity-collection-list__table"
    >
      <template #item.actions="{ item }">
        <v-btn
          icon="mdi-open-in-new"
          variant="text"
          size="small"
          density="comfortable"
          aria-label="Открыть карточку"
          @click="openEntity(item)"
        />
      </template>

      <template #item._id="{ item }">
        <span class="text-caption text-medium-emphasis">{{ item._id }}</span>
      </template>

      <template v-for="col in columns" :key="col.key" #[`item.${col.key}`]="{ item }">
        <Select
          v-if="col.lst"
          v-model="item.raw[col.key]"
          :collection="collection"
          :_id="item._id"
          :field="col.key"
          :lst-name="col.lst"
          :context-key="`${item._id}:${col.key}`"
          density="compact"
          variant="outlined"
          hide-details
          single-line
        />
        <Input
          v-else
          v-model="item.raw[col.key]"
          :collection="collection"
          :_id="item._id"
          :field="col.key"
          :context-key="`${item._id}:${col.key}`"
          density="compact"
          variant="outlined"
          hide-details
          single-line
        />
      </template>
    </v-data-table>
  </v-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { getApi } from '../main.js';
import { addFavourite } from '../utils/favouriteActions.js';
import { useStore } from '../stores/store.js';
import Input from './Input.vue';
import Select from './Select.vue';

const props = defineProps({
  collection: { type: String, required: true },
  collectionTitle: { type: String, default: '' },
});

const emit = defineEmits(['open-entity', 'favourite-added']);

const globalStore = useStore();

const loading = ref(false);
const addingFavourite = ref(false);
const errorText = ref('');
const favouriteMessage = ref('');
const searchQuery = ref('');
const listTitle = ref('');
const columns = ref([]);
const rows = ref([]);
let debounceTimer = null;

const tableHeaders = computed(() => [
  { title: '', key: 'actions', sortable: false, width: 52 },
  { title: 'ID', key: '_id', sortable: true, width: 110 },
  ...columns.value.map((col) => ({
    title: col.key,
    key: col.key,
    sortable: true,
  })),
]);

async function loadList() {
  const listMethod = getApi()?.core?.getCollectionList;
  if (!listMethod) {
    errorText.value = 'API getCollectionList недоступен';
    return;
  }

  loading.value = true;
  errorText.value = '';
  try {
    const search = searchQuery.value.trim();
    const response = await listMethod({
      collection: props.collection,
      search: search.length >= 3 ? search : '',
      limit: 100,
    });

    listTitle.value = response.title || props.collectionTitle || props.collection;
    columns.value = Array.isArray(response.columns) ? response.columns : [];

    if (response.lst && typeof response.lst === 'object') {
      globalStore.setData({ lst: response.lst });
    }

    rows.value = (Array.isArray(response.rows) ? response.rows : []).map((row) => {
      const raw = {};
      for (const col of columns.value) {
        const v = row.rawCells?.[col.key];
        raw[col.key] = v === null || v === undefined ? '' : String(v);
      }
      return { _id: row._id, title: row.title, raw };
    });
  } catch (error) {
    errorText.value = error.message || 'Не удалось загрузить список';
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void loadList(), 300);
}

async function onAddRegistryToFavourites() {
  addingFavourite.value = true;
  favouriteMessage.value = '';
  try {
    const res = await addFavourite({
      title: listTitle.value || props.collectionTitle || props.collection,
      icon: 'mdi-database-search-outline',
      targetKind: 'registry',
      targetCollection: props.collection,
    });
    favouriteMessage.value = res.duplicate ? 'Реестр уже в избранном' : 'Реестр добавлен в избранное';
    emit('favourite-added', res.favourite);
  } catch (error) {
    errorText.value = error.message || 'Не удалось добавить реестр в избранное';
  } finally {
    addingFavourite.value = false;
  }
}

function openEntity(item) {
  if (!item?._id) return;
  emit('open-entity', {
    collection: props.collection,
    code: String(item._id),
    title: String(item.title || item._id),
    groupTitle: listTitle.value,
  });
}

onMounted(() => {
  void loadList();
});

watch(
  () => props.collection,
  () => {
    searchQuery.value = '';
    void loadList();
  },
);
</script>

<style scoped>
.entity-collection-list__search {
  flex: 1 1 240px;
  max-width: 360px;
}

.entity-collection-list__table :deep(.app-input-wrap),
.entity-collection-list__table :deep(.app-select-wrap) {
  min-width: 120px;
  max-width: 280px;
}
</style>
