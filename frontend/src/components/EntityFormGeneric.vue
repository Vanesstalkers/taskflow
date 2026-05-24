<template>
  <EntityViewLayout
    :collection="collection"
    :entity-id="entityId"
    :display-title="displayTitle"
    :loading="loading"
    :load-error="loadError"
    :favourite-message="favouriteMessage"
    :adding-favourite="addingFavourite"
    :record="record"
    :on-add-to-favourites="onAddToFavourites"
  >
    <template #default="{ record: doc }">
      <template v-if="doc">
        <v-row dense>
          <v-col v-for="row in fieldRows(doc)" :key="row.key" cols="12" sm="6">
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
        <p v-if="fieldRows(doc).length === 0" class="text-body-2 text-medium-emphasis">
          Нет полей для отображения
        </p>
      </template>

      <p v-else-if="!loading && !loadError" class="text-body-2 text-medium-emphasis">
        Объект не найден в store. Выберите его снова из поиска.
      </p>
    </template>
  </EntityViewLayout>
</template>

<script setup>
import EntityViewLayout from './EntityViewLayout.vue';
import { formatEntityFieldValue, useEntityView } from '../composables/useEntityView.js';

const props = defineProps({
  collection: { type: String, required: true },
  entityId: { type: String, required: true },
  groupTitle: { type: String, default: '' },
  tabType: { type: String, default: 'entity' },
});

const emit = defineEmits(['favourite-added']);

const {
  loading,
  loadError,
  addingFavourite,
  favouriteMessage,
  record,
  displayTitle,
  onAddToFavourites,
} = useEntityView(props, emit);

function fieldRows(doc) {
  if (!doc || typeof doc !== 'object') return [];
  return Object.entries(doc)
    .filter(([key]) => key !== '_id')
    .map(([key, value]) => ({
      key,
      display: formatEntityFieldValue(value),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
</script>
