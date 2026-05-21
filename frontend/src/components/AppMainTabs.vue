<template>
  <div class="app-main-tabs">
    <v-tabs
      v-model="activeTabModel"
      density="compact"
      class="app-main-tabs__bar border-b"
      show-arrows
    >
      <v-tab
        v-for="tab in tabs"
        :key="tab.id"
        :value="tab.id"
        :class="{ 'app-main-tabs__tab--closable': tab.closable }"
      >
        <span class="app-main-tabs__title text-truncate">{{ tab.title }}</span>
        <v-btn
          v-if="tab.closable"
          icon
          variant="text"
          size="x-small"
          density="compact"
          class="app-main-tabs__close ms-1"
          aria-label="Закрыть вкладку"
          @click.stop="emit('close-tab', tab.id)"
        >
          <v-icon size="small">mdi-close</v-icon>
        </v-btn>
      </v-tab>
    </v-tabs>

    <v-tabs-window v-model="activeTabModel" class="app-main-tabs__window">
      <v-tabs-window-item :value="boardTabId">
        <slot name="board" />
      </v-tabs-window-item>

      <v-tabs-window-item v-for="tab in closableTabs" :key="tab.id" :value="tab.id">
        <div class="app-main-tabs__panel pa-4">
          <EntityCollectionList
            v-if="tab.type === 'collection-list'"
            :collection="tab.collection"
            :collection-title="tab.title"
            @open-entity="emit('open-entity', $event)"
            @favourite-added="emit('favourite-added', $event)"
          />
          <SearchEntityForm
            v-else
            :collection="tab.collection"
            :entity-id="tab.code"
            :group-title="tab.groupTitle"
            :tab-type="tab.type"
            @favourite-added="emit('favourite-added', $event)"
          />
        </div>
      </v-tabs-window-item>
    </v-tabs-window>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import EntityCollectionList from './EntityCollectionList.vue';
import SearchEntityForm from './SearchEntityForm.vue';
import { BOARD_TAB_ID } from '../composables/useAppTabs.js';

const props = defineProps({
  tabs: { type: Array, required: true },
  activeTabId: { type: String, required: true },
});

const emit = defineEmits(['update:activeTabId', 'close-tab', 'favourite-added', 'open-entity']);

const boardTabId = BOARD_TAB_ID;

const activeTabModel = computed({
  get: () => props.activeTabId,
  set: (v) => emit('update:activeTabId', v),
});

const closableTabs = computed(() => props.tabs.filter((t) => t.closable));
</script>

<style scoped>
.app-main-tabs {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.app-main-tabs__bar {
  flex-shrink: 0;
}

.app-main-tabs__window {
  flex: 1;
  min-height: 0;
}

.app-main-tabs__tab--closable {
  min-width: 120px;
  max-width: 220px;
}

.app-main-tabs__title {
  max-width: 160px;
}

.app-main-tabs__close {
  flex-shrink: 0;
}

.app-main-tabs__panel {
  max-width: 100%;
}
</style>
