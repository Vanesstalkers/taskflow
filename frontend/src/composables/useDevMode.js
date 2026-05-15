import { ref, watch } from 'vue';

const STORAGE_KEY = 'taskflow.devMode';

const devMode = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1',
);

function applyDevModeClass(active) {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('dev-mode-active', Boolean(active));
}

watch(
  devMode,
  (active) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, active ? '1' : '0');
    }
    applyDevModeClass(active);
  },
  { immediate: true },
);

/** Глобальный dev-режим: правки, подсветка якорей, ПКМ-замечания */
export function useDevMode() {
  return { devMode };
}
