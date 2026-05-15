<template>
  <v-dialog v-model="open" max-width="520" persistent @click:outside="close">
    <v-card>
      <v-card-title class="text-h6">Замечание к элементу</v-card-title>
      <v-card-subtitle v-if="anchorLabel" class="text-wrap">{{ anchorLabel }}</v-card-subtitle>
      <v-card-text>
        <p class="text-caption text-medium-emphasis mb-2">Подсказки</p>
        <div class="remark-hints d-flex flex-wrap ga-2 mb-3">
          <v-btn
            v-for="hint in remarkHints"
            :key="hint"
            variant="tonal"
            size="small"
            class="remark-hint-btn text-none"
            :disabled="saving"
            @click="applyHint(hint)"
          >
            {{ hint }}
          </v-btn>
        </div>
        <v-textarea
          v-model="comment"
          label="Комментарий"
          variant="outlined"
          rows="4"
          auto-grow
          :disabled="saving"
          autofocus
        />
      </v-card-text>
      <v-alert v-if="errorText" type="error" variant="tonal" density="compact" class="mx-4 mb-2">
        {{ errorText }}
      </v-alert>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="close">Отмена</v-btn>
        <v-btn color="primary" :loading="saving" @click="submit">Сохранить</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { saveRemark } from '../utils/remarkActions.js';

const open = defineModel({ type: Boolean, default: false });

const emit = defineEmits(['saved']);

const props = defineProps({
  payload: { type: Object, default: null },
});

const remarkHints = [
  'Добавь поле "новое_поле"',
  'Сгруппируй этот блок более компактно',
  'Удали это поле',
  'Переименуй подпись поля в "новая_подпись"',
  'Сделай поле обязательным',
  'Исправь выравнивание и отступы',
];

const comment = ref('');
const saving = ref(false);
const errorText = ref('');

function applyHint(text) {
  comment.value = text;
  errorText.value = '';
}

const anchorLabel = computed(() => {
  const p = props.payload;
  if (!p) return '';
  if (p.devId) return p.devId;
  if (p.partialDevId) return p.partialDevId;
  return '';
});

watch(open, (isOpen) => {
  if (isOpen) {
    comment.value = '';
    errorText.value = '';
    saving.value = false;
  }
});

function close() {
  if (saving.value) return;
  open.value = false;
}

async function submit() {
  const text = String(comment.value || '').trim();
  if (!text) {
    errorText.value = 'Введите комментарий';
    return;
  }
  const p = props.payload;
  if (!p?.partialDevId && !p?.devId) {
    errorText.value = 'Не удалось определить элемент';
    return;
  }

  saving.value = true;
  errorText.value = '';
  try {
    await saveRemark({
      comment: text,
      devId: p.devId || '',
      partialDevId: p.partialDevId || '',
      route: p.route || '',
      ui: p.ui || {},
      domain: p.domain || {},
      context: p.context || {},
    });
    open.value = false;
    emit('saved');
  } catch (err) {
    errorText.value = err?.message || 'Не удалось сохранить замечание';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.remark-hint-btn {
  height: auto !important;
  min-height: 28px;
  padding-top: 4px;
  padding-bottom: 4px;
  white-space: normal;
  text-align: start;
  line-height: 1.25;
}
</style>
