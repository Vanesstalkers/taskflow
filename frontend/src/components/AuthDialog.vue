<template>
  <v-dialog v-model="open" max-width="460" persistent>
    <v-card>
      <v-card-title>Вход в систему</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="authLogin"
          label="Логин"
          variant="outlined"
          class="mb-3"
          :disabled="authLoading"
          @keyup.enter="submitAuth"
        />
        <v-text-field
          v-model="authPassword"
          label="Пароль"
          type="password"
          variant="outlined"
          :disabled="authLoading"
          @keyup.enter="submitAuth"
        />
      </v-card-text>
      <v-alert v-if="authError" type="error" variant="tonal" class="mb-3">
        {{ authError }}
      </v-alert>
      <v-card-actions>
        <v-btn variant="text" :disabled="authLoading" @click="submitRegister"> Зарегистрироваться </v-btn>
        <v-spacer />
        <v-btn color="primary" :loading="authLoading" @click="submitAuth">Войти</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue';
import { getApi } from '../main.js';
import { useStore } from '../stores/store.js';

const getAuthSignin = () => getApi()?.auth?.signin;
const getAuthRegister = () => getApi()?.auth?.register;

const globalStore = useStore();

const open = ref(false);
const authLoading = ref(false);
const authLogin = ref('');
const authPassword = ref('');
const authError = ref('');

let pendingResolve = null;

/** Открывает диалог и резолвит `Promise`, когда вход или регистрация успешны. */
function openAndWait() {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    authError.value = '';
    open.value = true;
  });
}

function finishSuccess() {
  authPassword.value = '';
  open.value = false;
  const resolve = pendingResolve;
  pendingResolve = null;
  if (resolve) resolve(true);
}

defineExpose({ openAndWait });

async function submitAuth() {
  const signin = getAuthSignin();
  if (typeof signin !== 'function') {
    authError.value = 'API auth.signin недоступен';
    return;
  }
  if (!authLogin.value.trim() || !authPassword.value) {
    authError.value = 'Укажи логин и пароль';
    return;
  }
  authLoading.value = true;
  authError.value = '';
  try {
    const response = await signin({
      login: authLogin.value.trim(),
      password: authPassword.value,
    });
    if (response?.token) {
      const { _id, login, pp } = response?.user || {};
      const ppLink =
        pp && typeof pp === 'object'
          ? Object.fromEntries(Object.keys(pp).map((ppId) => [ppId, {}]))
          : {};

      if (!globalStore.store.user) globalStore.store.user = {};
      globalStore.store.user[_id] = { ...(globalStore.store.user[_id] || {}), _id, login, pp: ppLink };
      const ppStore = response.store?.pp;
      if (ppStore && typeof ppStore === 'object') {
        globalStore.store.pp = { ...(globalStore.store.pp || {}), ...ppStore };
      }
      globalStore.currentUserId = _id;

      localStorage.setItem('metarhia.session.token', response.token);

      finishSuccess();
      return;
    }
    authError.value = 'Не удалось выполнить вход';
  } catch (error) {
    authError.value = error.message || 'Ошибка авторизации';
  } finally {
    authLoading.value = false;
  }
}

async function submitRegister() {
  const register = getAuthRegister();
  if (typeof register !== 'function') {
    authError.value = 'API auth.register недоступен';
    return;
  }
  if (!authLogin.value.trim() || !authPassword.value) {
    authError.value = 'Укажи логин и пароль';
    return;
  }
  authLoading.value = true;
  authError.value = '';
  try {
    const response = await register({
      login: authLogin.value.trim(),
      password: authPassword.value,
    });
    if (response?.token) {
      const { _id, login } = response?.user || {};

      globalStore.currentUserId = _id;
      globalStore.store.user[_id] = { _id, login };

      localStorage.setItem('metarhia.session.token', response.token);

      finishSuccess();
      return;
    }
    authError.value = 'Не удалось выполнить регистрацию';
  } catch (error) {
    authError.value = error.message || 'Ошибка регистрации';
  } finally {
    authLoading.value = false;
  }
}
</script>
