<template>
  <div>
    <p class="text-caption text-medium-emphasis mb-2">
      Задача на добавление пользователя: опишите требования и контекст; связи с учётными записями настраиваются на
      вкладке «Исполнители».
    </p>
    <Textarea
      v-model="description"
      collection="task"
      :_id="task._id"
      field="description"
      label="Описание"
      rows="4"
      :context-key="task._id"
    />

    <ComplexBlock
      v-model="createdUserIds"
      add-placeholder="Поиск по имени или логину (от 3 символов)"
      collection="user"
      parent-collection="task"
      :parent-id="task._id"
      link-field="createdUserLinks"
      :context-key="task._id"
      separate-create-button
      inline-separate-create
      hide-search-input
    >
      <template #label="{ _id, record = {} }">
        <Textarea
          v-model="record.login"
          collection="user"
          :_id="_id"
          field="login"
          label="Логин"
          rows="1"
          :context-key="_id"
        />
        <Textarea
          v-model="record.password"
          collection="user"
          :_id="_id"
          field="password"
          label="Пароль"
          rows="1"
          :context-key="_id"
        />
      </template>
    </ComplexBlock>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ComplexBlock from '../ComplexBlock.vue';
import Textarea from '../Textarea.vue';

const props = defineProps({
  task: { type: Object, required: true },
});

const description = defineModel('description', { type: String, default: '' });
const createdUserIds = computed({
  get: () => Object.keys(props.task?.createdUserLinks || {}).filter(Boolean),
  set: () => {},
});
</script>
