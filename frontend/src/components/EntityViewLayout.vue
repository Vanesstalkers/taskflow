<template>
  <v-card variant="outlined" class="entity-view-layout pa-4">
    <div v-if="!chromeless" class="d-flex align-start justify-space-between mb-4 ga-2">
      <div>
        <h2 class="text-h6">{{ displayTitle }}</h2>
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

    <slot :record="record" :loading="loading" :load-error="loadError" />
  </v-card>
</template>

<script setup>
defineProps({
  collection: { type: String, required: true },
  entityId: { type: String, required: true },
  /** Без общего заголовка (кастомная форма рисует свой) */
  chromeless: { type: Boolean, default: false },
  displayTitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  loadError: { type: String, default: '' },
  favouriteMessage: { type: String, default: '' },
  addingFavourite: { type: Boolean, default: false },
  record: { type: Object, default: null },
  onAddToFavourites: { type: Function, required: true },
});
</script>

<style scoped>
.entity-view-layout {
  max-width: 960px;
}
</style>
