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
    <template #default>
      <template v-if="record">
        <v-row v-if="login || canChangePassword" dense class="user-credentials mb-3" align="center">
          <v-col v-if="login" cols="12" sm="auto" class="py-1">
            <span class="text-body-2 text-medium-emphasis">
              Логин: <span class="text-high-emphasis">{{ login }}</span>
            </span>
          </v-col>
          <v-col v-if="canChangePassword" cols="12" sm class="py-1 ms-sm-auto">
            <div class="user-password-form">
              <v-text-field
                v-model="newPassword"
                type="password"
                label="Новый пароль"
                variant="outlined"
                density="compact"
                hide-details
                autocomplete="new-password"
                class="user-password-form__field"
                :disabled="savingPassword"
              />
              <v-text-field
                v-model="confirmPassword"
                type="password"
                label="Подтверждение"
                variant="outlined"
                density="compact"
                hide-details
                autocomplete="new-password"
                class="user-password-form__field"
                :disabled="savingPassword"
                @keydown.enter.prevent="savePassword"
              />
              <v-btn
                color="primary"
                size="small"
                variant="tonal"
                class="user-password-form__btn"
                :loading="savingPassword"
                :disabled="savingPassword || !newPassword || !confirmPassword"
                @click="savePassword"
              >
                Сохранить
              </v-btn>
            </div>
            <p
              v-if="passwordMessage"
              class="user-password-form__message text-caption mb-0"
              :class="passwordMessageType === 'success' ? 'text-success' : 'text-error'"
            >
              {{ passwordMessage }}
            </p>
          </v-col>
        </v-row>

        <ComplexBlock
          class="mb-4"
          :model-value="userRoleListKeys"
          :list="{ lstName: 'userRoles' }"
          :persist="{
            collection: 'userRole',
            parentCollection: 'user',
            parentId: entityId,
            linkField: 'userRoleList',
            contextKey: entityId,
          }"
          :add="{
            addType: 'select',
            pickCreatesDocument: true,
            allowDuplicatePickField: false,
            showCreateNewOption: false,
          }"
          :texts="{
            blockTitle: 'Роли',
            emptyText: 'Роли не выбраны',
            addFieldLabel: 'Роли',
            addPlaceholder: 'Выберите роль из списка',
          }"
        >
          <template #label="{ _id: roleId, record: roleRecord }">
            <span>{{ roleLabel(roleRecord, roleId) }}</span>
          </template>
        </ComplexBlock>

        <template v-if="ppId && ppRecord">
          <v-row dense>
            <v-col cols="12" sm="4">
              <Input
                v-model="ppRecord.lastName"
                collection="pp"
                :_id="ppId"
                field="lastName"
                label="Фамилия"
                :context-key="`${entityId}:lastName`"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <Input
                v-model="ppRecord.firstName"
                collection="pp"
                :_id="ppId"
                field="firstName"
                label="Имя"
                :context-key="`${entityId}:firstName`"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <Input
                v-model="ppRecord.middleName"
                collection="pp"
                :_id="ppId"
                field="middleName"
                label="Отчество"
                :context-key="`${entityId}:middleName`"
              />
            </v-col>
          </v-row>
        </template>

        <div v-else class="d-flex flex-column ga-3">
          <p class="text-body-2 text-medium-emphasis mb-0">
            Персональные данные (ФИО) не привязаны к пользователю.
          </p>
          <v-btn
            variant="tonal"
            size="small"
            class="align-self-start"
            :loading="creatingPp"
            :disabled="creatingPp"
            @click="createPp"
          >
            Добавить ФИО
          </v-btn>
        </div>
      </template>

      <p v-else-if="!loading && !loadError" class="text-body-2 text-medium-emphasis">
        Пользователь не найден. Откройте запись из поиска или реестра.
      </p>
    </template>
  </EntityViewLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import EntityViewLayout from '../EntityViewLayout.vue';
import ComplexBlock from '../ComplexBlock.vue';
import Input from '../Input.vue';
import { useEntityView } from '../../composables/useEntityView.js';
import { getApi } from '../../main.js';
import { useStore } from '../../stores/store.js';
import { addObject, saveField } from '../../utils/storeActions.js';

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
  displayTitle: baseDisplayTitle,
  onAddToFavourites,
} = useEntityView(props, emit);

const creatingPp = ref(false);
const newPassword = ref('');
const confirmPassword = ref('');
const savingPassword = ref(false);
const passwordMessage = ref('');
const passwordMessageType = ref('error');

const login = computed(() => String(record.value?.login ?? '').trim());

/** Бэкенд маскирует недоступное поле как password: null (fieldAccess). */
const canChangePassword = computed(() => {
  const userId = String(props.entityId || '').trim();
  if (!userId || loading.value) return false;
  const rec = globalStore.store.user?.[userId] ?? record.value;
  if (!rec || typeof rec !== 'object') return false;
  if (!('password' in rec)) return true;
  return rec.password !== null;
});

async function savePassword() {
  const entityId = String(props.entityId || '').trim();
  if (!entityId || savingPassword.value) return;

  passwordMessage.value = '';
  const pwd = newPassword.value;
  const confirm = confirmPassword.value;
  if (!pwd) {
    passwordMessage.value = 'Введите новый пароль';
    passwordMessageType.value = 'error';
    return;
  }
  if (pwd !== confirm) {
    passwordMessage.value = 'Пароли не совпадают';
    passwordMessageType.value = 'error';
    return;
  }

  savingPassword.value = true;
  try {
    await saveField({
      collection: 'user',
      _id: entityId,
      data: { password: pwd },
    });
    newPassword.value = '';
    confirmPassword.value = '';
    passwordMessage.value = 'Пароль сохранён';
    passwordMessageType.value = 'success';
  } catch (error) {
    passwordMessage.value = error.message || 'Не удалось сохранить пароль';
    passwordMessageType.value = 'error';
  } finally {
    savingPassword.value = false;
  }
}

const userRoleListKeys = computed(() => {
  const userId = String(props.entityId || '').trim();
  const links = globalStore.store.user?.[userId]?.userRoleList ?? record.value?.userRoleList;
  if (!links || typeof links !== 'object' || Array.isArray(links)) return [];
  return Object.keys(links).filter(Boolean);
});

function roleLabel(roleRecord, roleId) {
  const code = String(roleRecord?.type ?? '').trim();
  if (!code) return String(roleId || '');
  const items = globalStore.lst.userRoles;
  if (Array.isArray(items)) {
    const item = items.find((row) => String(row.code) === code);
    if (item?.title) return String(item.title);
  }
  return code;
}

const ppId = computed(() => {
  const links = record.value?.pp;
  if (!links || typeof links !== 'object' || Array.isArray(links)) return '';
  const keys = Object.keys(links).filter(Boolean);
  return keys[0] || '';
});

const ppRecord = computed(() => {
  const id = ppId.value;
  if (!id) return null;
  if (!globalStore.store.pp) globalStore.store.pp = {};
  if (!globalStore.store.pp[id]) globalStore.store.pp[id] = { _id: id };
  return globalStore.store.pp[id];
});

const displayTitle = computed(() => {
  const pp = ppRecord.value;
  if (pp) {
    const fio = [pp.lastName, pp.firstName, pp.middleName]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(' ');
    if (fio) return fio;
  }
  return baseDisplayTitle.value;
});

async function loadUser() {
  const getEntity = getApi()?.core?.getEntity;
  const id = String(props.entityId || '').trim();
  if (!getEntity || !id) return;

  loading.value = true;
  loadError.value = '';
  try {
    const res = await getEntity({ collection: 'user', _id: id });
    if (res?.error) {
      loadError.value =
        res.error === 'not_found' ? 'Пользователь не найден' : 'Не удалось загрузить пользователя';
      return;
    }
    if (res?.store && typeof res.store === 'object') {
      globalStore.setData({ lst: res.lst || {}, store: res.store });
    }
  } catch (error) {
    loadError.value = error.message || 'Не удалось загрузить пользователя';
  } finally {
    loading.value = false;
  }
}

async function createPp() {
  const userId = String(props.entityId || '').trim();
  if (!userId || creatingPp.value) return;

  creatingPp.value = true;
  loadError.value = '';
  try {
    await addObject({
      collection: 'pp',
      document: { firstName: '', lastName: '', middleName: '' },
      link: {
        collection: 'user',
        _id: userId,
        linkField: 'pp',
        linkPayload: {},
      },
    });
    await loadUser();
  } catch (error) {
    loadError.value = error.message || 'Не удалось создать персональные данные';
  } finally {
    creatingPp.value = false;
  }
}

onMounted(() => {
  const getLst = getApi()?.core?.getLst;
  if (getLst) {
    void globalStore.fetchLst({ name: 'userRoles', getLst });
  }
  void loadUser();
});

watch(
  () => props.entityId,
  () => {
    newPassword.value = '';
    confirmPassword.value = '';
    passwordMessage.value = '';
    void loadUser();
  },
);
</script>

<style scoped>
.user-credentials {
  row-gap: 0;
}

.user-password-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.user-password-form__field {
  flex: 1 1 120px;
  min-width: 112px;
  max-width: 168px;
}

.user-password-form__btn {
  flex: 0 0 auto;
  height: 40px;
}

.user-password-form__message {
  margin-top: 4px;
  text-align: right;
}
</style>
