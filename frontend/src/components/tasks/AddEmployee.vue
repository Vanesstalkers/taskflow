<template>
  <div class="d-flex flex-column ga-4">
    <Employee
      :task-type="task.taskType"
      :link-schema-path="['createdEmployeeLinks']"
      :persist="{
        collection: 'employee',
        parentCollection: 'task',
        parentId: task._id,
        linkField: 'createdEmployeeLinks',
        taskType: task.taskType,
      }"
      :add="employeeAdd"
      :texts="employeeTexts"
      :manager-add="managerAdd"
      :manager-texts="managerTexts"
    />
  </div>
</template>

<script setup>
import Employee from '../complex/Employee.vue';

defineProps({
  task: { type: Object, required: true },
});

const employeeAdd = {
  addType: 'button',
  separateCreateButton: true,
  maxSelection: 1,
  minSelection: 1,
};

const employeeTexts = {
  blockTitle: 'Сотрудник',
  emptyText: 'Добавьте сотрудника',
};

const managerAdd = {
  addType: 'search',
  addPlacement: 'inline',
  showCreateNewOption: false,
  minSelection: 0,
  maxSelection: 1,
};

const managerTexts = {
  blockTitle: 'Начальник',
  emptyText: 'Начальник не указан',
  addPlaceholder: 'Поиск по должности (от 3 символов)',
};
</script>
