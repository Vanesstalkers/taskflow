import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import { useTasksStore } from "./stores/tasks.js";
import "./style.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(vuetify).mount("#app");

const tasksStore = useTasksStore(pinia);
window.store = tasksStore.store;
window.tasksStore = tasksStore;
