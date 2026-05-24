<template>
  <component
    :is="viewComponent"
    :collection="collection"
    :entity-id="entityId"
    :group-title="groupTitle"
    :tab-type="tabType"
    @favourite-added="emit('favourite-added', $event)"
  />
</template>

<script setup>
import { computed } from 'vue';
import { resolveEntityViewComponent } from './entities/registry.js';
import EntityFormGeneric from './EntityFormGeneric.vue';

const props = defineProps({
  collection: { type: String, required: true },
  entityId: { type: String, required: true },
  groupTitle: { type: String, default: '' },
  tabType: { type: String, default: 'entity' },
});

const emit = defineEmits(['favourite-added']);

const viewComponent = computed(
  () => resolveEntityViewComponent(props.collection) || EntityFormGeneric,
);
</script>
