<template>
  <v-navigation-drawer
    :model-value="true"
    permanent
    :rail="rail"
    class="app-favourites-sidebar border-e"
    width="240"
    rail-width="56"
  >
    <div class="app-favourites-sidebar__header pa-2 d-flex align-center" :class="{ 'justify-center': rail }">
      <span v-if="!rail" class="text-subtitle-2 font-weight-medium px-2">Избранное</span>
      <v-spacer v-if="!rail" />
      <v-btn
        :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
        variant="text"
        size="small"
        density="comfortable"
        :aria-label="rail ? 'Развернуть' : 'Свернуть'"
        @click="emit('update:rail', !rail)"
      />
    </div>

    <v-list density="compact" nav class="app-favourites-sidebar__list">
      <v-list-item
        v-for="item in favourites"
        :key="item._id"
        :value="item._id"
        :title="rail ? undefined : item.title"
        @click="emit('open', item)"
      >
        <template #prepend>
          <v-icon :icon="normalizeMdiIcon(item.icon)" />
        </template>
        <template v-if="!rail" #append>
          <v-btn
            icon="mdi-pencil-outline"
            variant="text"
            size="x-small"
            density="comfortable"
            aria-label="Редактировать"
            @click.stop="emit('edit', item)"
          />
        </template>
        <v-tooltip v-if="rail" activator="parent" location="end">
          {{ item.title }}
        </v-tooltip>
      </v-list-item>

      <v-list-item v-if="favourites.length === 0 && !rail" disabled title="Пока пусто" />
    </v-list>

    <template #append>
      <div class="pa-2">
        <v-btn
          v-if="canAddFromTab"
          block
          variant="tonal"
          size="small"
          @click="emit('add-from-tab')"
        >
          <v-icon>mdi-star-plus-outline</v-icon>
          <span v-if="!rail" class="ms-2">В избранное</span>
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<script setup>
import { normalizeMdiIcon } from '../utils/favouriteActions.js';

defineProps({
  favourites: { type: Array, default: () => [] },
  rail: { type: Boolean, default: false },
  canAddFromTab: { type: Boolean, default: false },
});

const emit = defineEmits(['update:rail', 'open', 'edit', 'add-from-tab']);
</script>

<style scoped>
.app-favourites-sidebar__list {
  flex: 1;
  overflow-y: auto;
}

.app-favourites-sidebar__header {
  min-height: 48px;
  flex-shrink: 0;
}
</style>
