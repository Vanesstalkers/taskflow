import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import { useStore } from "./stores/store.js";
import "./style.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(vuetify).mount("#app");

const globalStore = useStore(pinia);
window.store = globalStore.store;
window.lst = globalStore.lst;