import { reactive, ref } from 'vue';

/** Ошибки полей детальной панели (валидация / сеть). */
export const panelFieldErrors = reactive({
  title: '',
  description: '',
  assignees: '',
});

export const panelActiveTab = ref('main');

export function clearPanelFieldErrors() {
  panelFieldErrors.title = '';
  panelFieldErrors.description = '';
  panelFieldErrors.assignees = '';
}
