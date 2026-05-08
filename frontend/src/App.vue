<template>
  <v-app>
    <v-main class="d-flex align-center justify-center">
      <v-container class="text-center app-content">
        <h1 class="text-h4 mb-3">Frontend подключен к backend через Metacom</h1>
        <p class="text-body-1 mb-2">
          Схема подключения повторяет `console.js`: <code>ws(s)://location.host/api</code>.
        </p>
        <p class="text-body-2 mb-6">Статус: {{ status }}</p>

        <v-row class="mb-3" justify="center">
          <v-col cols="12" md="5">
            <v-text-field v-model="insertKey" label="Ключ" variant="outlined" density="comfortable" />
          </v-col>
          <v-col cols="12" md="5">
            <v-text-field
              v-model="insertValue"
              label="Значение"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>

        <v-btn
          color="primary"
          variant="elevated"
          :loading="loadingInsert"
          class="mb-6"
          @click="insertToMongo"
        >
          Сохранить в MongoDB
        </v-btn>

        <v-divider class="my-4" />

        <v-row class="mb-2" justify="center">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="searchKey"
              label="Ключ для чтения"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>

        <v-btn color="secondary" variant="elevated" :loading="loadingGet" @click="getFromMongo">
          Прочитать из MongoDB
        </v-btn>

        <v-alert
          v-if="mongoDocument"
          type="success"
          variant="tonal"
          class="mt-4 text-left"
        >
          Найдено: {{ mongoDocument }}
        </v-alert>

        <v-alert v-if="errorText" type="error" variant="tonal" class="mt-4 text-left">
          {{ errorText }}
        </v-alert>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { initBackend } from "./api/backend.js";

const status = ref("Инициализация...");
const errorText = ref("");
const insertKey = ref("");
const insertValue = ref("");
const searchKey = ref("");
const mongoDocument = ref("");
const loadingInsert = ref(false);
const loadingGet = ref(false);
let api = null;

const insertToMongo = async () => {
  if (!api) return;
  if (!insertKey.value || !insertValue.value) {
    errorText.value = "Заполни поля ключа и значения";
    return;
  }
  loadingInsert.value = true;
  errorText.value = "";
  try {
    const packet = await api.example.mongoInsert({
      key: insertKey.value,
      value: insertValue.value,
    });
    status.value = `Сохранено, id: ${packet.insertedId}`;
    searchKey.value = insertKey.value;
    await getFromMongo();
  } catch (error) {
    errorText.value = `Ошибка записи в MongoDB: ${error.message}`;
  } finally {
    loadingInsert.value = false;
  }
};

const getFromMongo = async () => {
  if (!api) return;
  if (!searchKey.value) {
    errorText.value = "Укажи ключ для чтения";
    return;
  }
  loadingGet.value = true;
  errorText.value = "";
  mongoDocument.value = "";
  try {
    const packet = await api.example.mongoGet({ key: searchKey.value });
    if (!packet.result) {
      status.value = "Документ не найден";
      return;
    }
    mongoDocument.value = JSON.stringify(packet.result, null, 2);
    status.value = "Документ получен";
  } catch (error) {
    errorText.value = `Ошибка чтения из MongoDB: ${error.message}`;
  } finally {
    loadingGet.value = false;
  }
};

onMounted(async () => {
  try {
    const backend = await initBackend();
    api = backend.api;
    status.value = "Подключено";
  } catch (error) {
    status.value = "Ошибка подключения";
    errorText.value = `Не удалось подключиться к backend: ${error.message}`;
  }
});
</script>

<style scoped>
code {
  font-family: Consolas, Menlo, Monaco, "Courier New", monospace;
}

.app-content {
  max-width: 840px;
}

.v-alert {
  white-space: pre-wrap;
}
</style>
