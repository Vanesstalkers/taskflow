<template>
  <ComplexBlock
    v-if="showBlock"
    :model-value="linkIds"
    :persist="persist"
    :add="add"
    :texts="texts"
    :ui="ui"
  >
    <template #label="{ _id, record = {} }">
      <slot name="label" :_id="_id" :record="record">
        <div class="d-flex flex-column ga-4 align-self-stretch w-100">
          <Input
            v-model="record.position"
            label="Должность"
            collection="employee"
            :_id="_id"
            field="position"
            :context-key="`${_id}:position`"
          />
          <Select
            :model-value="record.positionType || ''"
            lst-name="jobTitles"
            label="Тип должности"
            collection="employee"
            :_id="_id"
            field="positionType"
            :context-key="`${_id}:positionType`"
          />
          <ComplexBlock
            v-if="_id"
            :model-value="subdivisionIds(_id)"
            :persist="{
              collection: 'subdivision',
              parentCollection: 'employee',
              parentId: _id,
              linkField: 'subdivision',
            }"
            :add="{
              addType: 'search',
              showCreateNewOption: false,
              minSelection: 0,
              maxSelection: 1,
            }"
            :texts="{
              blockTitle: 'Подразделение',
              emptyText: 'Выберите подразделение',
              addPlaceholder: 'Поиск по названию (от 3 символов)',
            }"
            :ui="{ fullWidthLabels: true }"
          >
            <template #label="{ _id: subdivisionId, record: subdivisionRecord = {} }">
              <span>{{ subdivisionRecord?.name || subdivisionId }}</span>
            </template>
          </ComplexBlock>
          <PP
            v-if="_id"
            :parent-id="_id"
            parent-collection="employee"
            :ui="{ fullWidthLabels: true }"
          />
          <Employee
            v-if="_id && managerAdd && managerTexts"
            :persist="{
              collection: 'employee',
              parentCollection: 'employee',
              parentId: _id,
              linkField: 'manager',
            }"
            :add="managerAdd"
            :texts="managerTexts"
          >
            <template #label="{ _id: managerId, record: managerRecord = {} }">
              <div class="employee-manager-view d-flex flex-column ga-3 align-self-stretch w-100">
                <div class="employee-manager-view__field">
                  <div class="text-caption text-medium-emphasis">Должность</div>
                  <div class="text-body-2">{{ displayText(managerRecord.position) }}</div>
                </div>
                <div class="employee-manager-view__field">
                  <div class="text-caption text-medium-emphasis">Тип должности</div>
                  <div class="text-body-2">{{ lstTitle('jobTitles', managerRecord.positionType) }}</div>
                </div>
                <div class="employee-manager-view__field">
                  <div class="text-caption text-medium-emphasis">Подразделение</div>
                  <div class="text-body-2">{{ managerSubdivisionName(managerId) }}</div>
                </div>
                <div class="text-subtitle-2 text-high-emphasis mt-1">Персональные данные</div>
                <div class="employee-manager-view__field">
                  <div class="text-caption text-medium-emphasis">ФИО</div>
                  <div class="text-body-2">{{ managerFio(managerId) }}</div>
                </div>
                <div class="employee-manager-view__field">
                  <div class="text-caption text-medium-emphasis">Телефоны</div>
                  <ul
                    v-if="managerPhoneLines(managerId).length"
                    class="employee-manager-view__phones text-body-2 mb-0 ps-4"
                  >
                    <li v-for="(line, idx) in managerPhoneLines(managerId)" :key="idx">{{ line }}</li>
                  </ul>
                  <div v-else class="text-body-2">—</div>
                </div>
              </div>
            </template>
          </Employee>
        </div>
      </slot>
    </template>
  </ComplexBlock>
</template>

<script setup>
import { computed } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import Input from '../Input.vue';
import Select from '../Select.vue';
import PP from './PP.vue';
import { useStore } from '../../stores/store.js';
import { formatCode, formatNational } from '../../utils/phoneFormat.js';

const props = defineProps({
  persist: { type: Object, required: true },
  add: { type: Object, required: true },
  texts: { type: Object, required: true },
  managerAdd: { type: Object, default: undefined },
  managerTexts: { type: Object, default: undefined },
  ui: { type: Object, default: () => ({ fullWidthLabels: true }) },
});

const globalStore = useStore();

const showBlock = computed(() => Boolean(String(props.persist?.parentId || '').trim()));

const linkIds = computed(() => {
  const parentCollection = String(props.persist?.parentCollection || '').trim();
  const parentId = String(props.persist?.parentId || '').trim();
  const field = String(props.persist?.linkField || '').trim();
  if (!parentCollection || !parentId || !field) return [];
  return Object.keys(globalStore.store[parentCollection]?.[parentId]?.[field] || {}).filter(Boolean);
});

function subdivisionIds(employeeId) {
  return Object.keys(globalStore.store.employee?.[employeeId]?.subdivision || {}).filter(Boolean);
}

function ppIds(employeeId) {
  return Object.keys(globalStore.store.employee?.[employeeId]?.pp || {}).filter(Boolean);
}

function displayText(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}

function lstTitle(lstName, code) {
  const key = String(code ?? '').trim();
  if (!key) return '—';
  const items = globalStore.lst[lstName];
  const hit = Array.isArray(items) ? items.find((item) => String(item?.code ?? '') === key) : null;
  return hit?.title ? String(hit.title) : key;
}

function managerSubdivisionName(managerId) {
  const ids = subdivisionIds(managerId);
  if (!ids.length) return '—';
  const record = globalStore.store.subdivision?.[ids[0]] || {};
  return displayText(record.name || ids[0]);
}

function managerFio(managerId) {
  const ids = ppIds(managerId);
  if (!ids.length) return '—';
  const pp = globalStore.store.pp?.[ids[0]] || {};
  const parts = [pp.lastName, pp.firstName, pp.middleName].map((part) => String(part ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function managerPhoneLines(managerId) {
  const ids = ppIds(managerId);
  if (!ids.length) return [];
  const ppId = ids[0];
  const linkMap = globalStore.store.pp?.[ppId]?.phoneList || {};
  return Object.keys(linkMap)
    .filter(Boolean)
    .map((phoneId) => {
      const phone = globalStore.store.phone?.[phoneId] || {};
      const typeLabel = lstTitle('phoneTypes', phone.phoneType);
      const number = [formatCode(phone.code), formatNational(phone.number)].filter(Boolean).join(' ').trim();
      const active = phone.active ? '' : ' (неактивный)';
      return number ? `${typeLabel}: ${number}${active}` : typeLabel;
    });
}
</script>

<style scoped>
.employee-manager-view__phones {
  list-style: disc;
}
</style>
