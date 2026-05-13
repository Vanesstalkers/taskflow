import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Metacom } from './api/metacom.js';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import { useStore } from './stores/store.js';
import './style.css';

/** ---------- Metacom / API ---------- */

let backendState;

const getApiUrl = () => {
  const protocol = location.protocol === 'http:' ? 'ws' : 'wss';
  return `${protocol}://${location.host}/api`;
};

export async function initBackend() {
  if (backendState) return backendState;

  const metacom = Metacom.create(getApiUrl(), { callTimeout: 100000 });
  await metacom.load('auth', 'core', 'files');

  backendState = { metacom, api: metacom.api };
  return backendState;
}

export function getBackendState() {
  return backendState;
}

export function getApi() {
  return backendState?.api;
}

/** ---------- Vue ---------- */

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(vuetify).mount('#app');

const globalStore = useStore(pinia);
window.store = globalStore.store;
window.lst = globalStore.lst;
