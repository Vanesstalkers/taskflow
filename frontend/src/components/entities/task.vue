<template>
  <EntityViewLayout
    chromeless
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
    <template #default="{ record: task }">
      <TaskForm
        v-if="task"
        embedded
        :task="task"
        :task-id="entityId"
        :task-type-label="taskTypeLabel"
        @add-favourite="onAddToFavourites"
      />
      <p v-else-if="!loading && !loadError" class="text-body-2 text-medium-emphasis">
        Задача не найдена в store. Откройте её из поиска или канбана.
      </p>
    </template>
  </EntityViewLayout>
</template>

<script setup>
import { computed } from 'vue';
import EntityViewLayout from '../EntityViewLayout.vue';
import TaskForm from '../TaskForm.vue';
import { useEntityView } from '../../composables/useEntityView.js';
import { useStore } from '../../stores/store.js';

const props = defineProps({
  collection: { type: String, required: true },
  entityId: { type: String, required: true },
  groupTitle: { type: String, default: '' },
  tabType: { type: String, default: 'entity' },
});

const emit = defineEmits(['favourite-added']);

const globalStore = useStore();

const {
  loading,
  loadError,
  addingFavourite,
  favouriteMessage,
  record,
  displayTitle,
  onAddToFavourites,
} = useEntityView(props, emit);

const taskTypeLabel = computed(() => {
  const code = String(record.value?.taskType || '').trim();
  if (!code) return '';
  const items = globalStore.lst.taskTypes;
  if (!Array.isArray(items)) return code;
  const hit = items.find((row) => String(row?.code ?? '') === code);
  return String(hit?.title || code).trim();
});
</script>
