<template>
  <v-dialog v-model="open" max-width="720" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <span>Правки пользователя</span>
        <v-spacer />
        <v-btn icon variant="text" :loading="loading" @click="loadRemarks">
          <v-icon>mdi-refresh</v-icon>
        </v-btn>
        <v-btn icon variant="text" @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-subtitle class="pb-2">
        ПКМ по полю с подсветкой якоря — новое замечание. Статусы: новая → на проверке (после правок агента) → готово.
      </v-card-subtitle>

      <v-tabs v-model="filterTab" density="compact" class="px-4">
        <v-tab value="all">Все ({{ remarks.length }})</v-tab>
        <v-tab value="new">Новые ({{ countByStatus.new }})</v-tab>
        <v-tab value="review">На проверке ({{ countByStatus.review }})</v-tab>
        <v-tab value="done">Готовые ({{ countByStatus.done }})</v-tab>
      </v-tabs>

      <v-divider />

      <v-card-text class="remarks-panel-body">
        <v-alert v-if="errorText" type="error" variant="tonal" density="compact" class="mb-3">
          {{ errorText }}
        </v-alert>

        <v-progress-linear v-if="loading" indeterminate class="mb-3" />

        <p v-else-if="filteredRemarks.length === 0" class="text-body-2 text-medium-emphasis">
          Нет замечаний в этой категории
        </p>

        <v-card
          v-for="item in filteredRemarks"
          :key="item._id"
          class="mb-3"
          variant="outlined"
        >
          <v-card-item>
            <div class="d-flex align-center flex-wrap ga-2 mb-1">
              <v-chip size="small" :color="remarkStatusMeta(item.status).color" variant="tonal">
                {{ remarkStatusMeta(item.status).title }}
              </v-chip>
              <v-chip v-if="item.revertRequested" size="x-small" color="error" variant="outlined">
                откат
              </v-chip>
              <span class="text-caption text-medium-emphasis">{{ formatRemarkDate(item.createdAt) }}</span>
            </div>
            <v-card-title class="text-subtitle-2 text-wrap pa-0">
              {{ item.devId || item.partialDevId || '—' }}
            </v-card-title>
            <v-card-subtitle v-if="uiHint(item)" class="text-wrap pa-0 mt-1">
              {{ uiHint(item) }}
            </v-card-subtitle>
          </v-card-item>

          <v-card-text class="pt-0">
            <p class="text-body-2 remarks-panel-comment">{{ item.comment }}</p>

            <template v-if="normalizeRemarkStatus(item.status) === 'review'">
              <v-textarea
                v-model="draftComments[item._id]"
                class="mt-3"
                label="Уточнение / что сломалось"
                variant="outlined"
                rows="3"
                auto-grow
                hide-details="auto"
                :disabled="Boolean(actionId)"
              />
              <div class="d-flex flex-wrap ga-2 mt-3">
                <v-btn
                  color="error"
                  variant="flat"
                  size="small"
                  :loading="actionId === item._id && actionKind === 'revert'"
                  :disabled="Boolean(actionId)"
                  @click="onRevert(item)"
                >
                  ВЕРНУТЬ КАК БЫЛО
                </v-btn>
                <v-btn
                  color="primary"
                  variant="tonal"
                  size="small"
                  :loading="actionId === item._id && actionKind === 'resubmit'"
                  :disabled="Boolean(actionId)"
                  @click="onResubmit(item)"
                >
                  Отправить снова
                </v-btn>
                <v-btn
                  color="success"
                  variant="tonal"
                  size="small"
                  :loading="actionId === item._id && actionKind === 'done'"
                  :disabled="Boolean(actionId)"
                  @click="onMarkDone(item)"
                >
                  Принять — готово
                </v-btn>
              </div>
            </template>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { getRemarks, resubmitRemark, revertRemark, setRemarkStatus } from '../utils/remarkActions.js';
import {
  formatRemarkDate,
  normalizeRemarkStatus,
  remarkStatusMeta,
} from '../utils/remarkStatus.js';

const open = defineModel({ type: Boolean, default: false });

const emit = defineEmits(['changed']);

const remarks = ref([]);
const loading = ref(false);
const errorText = ref('');
const filterTab = ref('all');
const draftComments = reactive({});
const actionId = ref('');
const actionKind = ref('');

const countByStatus = computed(() => {
  const counts = { new: 0, review: 0, done: 0 };
  for (const r of remarks.value) {
    const key = normalizeRemarkStatus(r.status);
    if (key in counts) counts[key] += 1;
  }
  return counts;
});

const filteredRemarks = computed(() => {
  if (filterTab.value === 'all') return remarks.value;
  return remarks.value.filter((r) => normalizeRemarkStatus(r.status) === filterTab.value);
});

function uiHint(item) {
  const ui = item?.ui;
  if (!ui?.file) return '';
  const line = ui.line ? `:${ui.line}` : '';
  const label = ui.label ? ` — ${ui.label}` : '';
  return `${ui.file}${line}${label}`;
}

async function loadRemarks() {
  loading.value = true;
  errorText.value = '';
  try {
    const res = await getRemarks({ limit: 200 });
    remarks.value = res.remarks || [];
    for (const r of remarks.value) {
      if (normalizeRemarkStatus(r.status) === 'review' && draftComments[r._id] === undefined) {
        draftComments[r._id] = r.comment || '';
      }
    }
  } catch (err) {
    errorText.value = err?.message || 'Не удалось загрузить замечания';
  } finally {
    loading.value = false;
  }
}

async function onRevert(item) {
  actionId.value = item._id;
  actionKind.value = 'revert';
  errorText.value = '';
  try {
    const note = String(draftComments[item._id] || '').trim();
    await revertRemark({ _id: item._id, comment: note });
    emit('changed');
    await loadRemarks();
  } catch (err) {
    errorText.value = err?.message || 'Не удалось запросить откат';
  } finally {
    actionId.value = '';
    actionKind.value = '';
  }
}

async function onResubmit(item) {
  const text = String(draftComments[item._id] || '').trim();
  if (!text) {
    errorText.value = 'Введите комментарий для повторной отправки';
    return;
  }
  actionId.value = item._id;
  actionKind.value = 'resubmit';
  errorText.value = '';
  try {
    await resubmitRemark({ _id: item._id, comment: text });
    emit('changed');
    await loadRemarks();
  } catch (err) {
    errorText.value = err?.message || 'Не удалось отправить замечание';
  } finally {
    actionId.value = '';
    actionKind.value = '';
  }
}

async function onMarkDone(item) {
  actionId.value = item._id;
  actionKind.value = 'done';
  errorText.value = '';
  try {
    await setRemarkStatus({ _id: item._id, status: 'done' });
    emit('changed');
    await loadRemarks();
  } catch (err) {
    errorText.value = err?.message || 'Не удалось обновить статус';
  } finally {
    actionId.value = '';
    actionKind.value = '';
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    filterTab.value = 'all';
    void loadRemarks();
  }
});

defineExpose({ loadRemarks, countByStatus });
</script>

<style scoped>
.remarks-panel-body {
  max-height: min(70vh, 640px);
  overflow-y: auto;
}

.remarks-panel-comment {
  white-space: pre-wrap;
}
</style>
