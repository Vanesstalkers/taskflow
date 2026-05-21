<template>
  <v-dialog :model-value="modelValue" max-width="440" @update:model-value="emit('update:modelValue', $event)">
    <v-card v-if="favourite">
      <v-card-title>Избранное</v-card-title>
      <v-card-text>
        <v-text-field v-model="draftTitle" label="Название" variant="outlined" density="compact" hide-details class="mb-3" />
        <v-text-field
          v-model="draftIcon"
          label="Иконка (mdi-star, star-outline…)"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2"
        />
        <div class="d-flex align-center ga-2 text-medium-emphasis">
          <v-icon :icon="previewIcon" size="small" />
          <span class="text-caption">Превью</span>
        </div>
        <p class="text-caption text-medium-emphasis mt-3 mb-0">
          {{ targetHint }}
        </p>
        <v-alert v-if="errorText" type="error" variant="tonal" density="compact" class="mt-3">
          {{ errorText }}
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn color="error" variant="text" :loading="removing" @click="onRemove">Удалить</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Отмена</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="onSave">Сохранить</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { normalizeMdiIcon, removeFavourite } from '../utils/favouriteActions.js';
import { saveField } from '../utils/storeActions.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  favourite: { type: Object, default: null },
});

const emit = defineEmits(['update:modelValue', 'saved', 'removed']);

const draftTitle = ref('');
const draftIcon = ref('');
const saving = ref(false);
const removing = ref(false);
const errorText = ref('');

const previewIcon = computed(() => normalizeMdiIcon(draftIcon.value));

const targetHint = computed(() => {
  const fav = props.favourite;
  if (!fav) return '';
  if (fav.targetKind === 'registry') return `Реестр · ${fav.targetCollection}`;
  return `${fav.targetCollection} · ${fav.targetId}`;
});

watch(
  () => [props.modelValue, props.favourite],
  () => {
    if (!props.modelValue || !props.favourite) return;
    draftTitle.value = String(props.favourite.title || '');
    draftIcon.value = String(props.favourite.icon || '');
    errorText.value = '';
  },
  { immediate: true },
);

async function onSave() {
  const fav = props.favourite;
  if (!fav?._id) return;
  saving.value = true;
  errorText.value = '';
  try {
    const title = draftTitle.value.trim() || 'Избранное';
    const icon = normalizeMdiIcon(draftIcon.value);
    const data = {};
    if (title !== fav.title) data.title = title;
    if (icon !== fav.icon) data.icon = icon;
    if (Object.keys(data).length > 0) {
      await saveField({ collection: 'favourite', _id: fav._id, data });
    }
    emit('saved', { ...fav, title, icon });
    emit('update:modelValue', false);
  } catch (error) {
    errorText.value = error.message || 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
}

async function onRemove() {
  const fav = props.favourite;
  if (!fav?._id) return;
  removing.value = true;
  errorText.value = '';
  try {
    await removeFavourite(fav._id);
    emit('removed', fav._id);
    emit('update:modelValue', false);
  } catch (error) {
    errorText.value = error.message || 'Не удалось удалить';
  } finally {
    removing.value = false;
  }
}
</script>
