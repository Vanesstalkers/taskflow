import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { useDevMode } from './useDevMode.js';
import { fetchDevAnchorManifest, resolveAnchorFromManifest } from '../utils/resolveDevAnchor.js';

/**
 * ПКМ по элементу с data-dev-id → модальное замечание.
 * @param {{ scopeHint: () => string }} options — taskType открытой задачи
 */
export function useDevRemarkCapture(options = {}) {
  const { devMode } = useDevMode();
  const remarkDialogOpen = ref(false);
  const remarkPayload = shallowRef(null);
  let manifest = null;

  async function loadManifest() {
    try {
      manifest = await fetchDevAnchorManifest();
    } catch {
      manifest = null;
    }
  }

  function buildPayload(target) {
    const el = target.closest('[data-dev-id]');
    if (!el) return null;

    const partialDevId = String(el.getAttribute('data-dev-id') || '').trim();
    if (!partialDevId) return null;

    const scopeHint = typeof options.scopeHint === 'function' ? options.scopeHint() : '';
    const resolved = resolveAnchorFromManifest(manifest, partialDevId, scopeHint);

    const devId = resolved?.devId || '';
    const anchor = resolved?.anchor;

    return {
      partialDevId,
      devId,
      route: typeof location !== 'undefined' ? location.pathname + location.search : '',
      ui: anchor?.ui ? { ...anchor.ui } : {},
      domain: anchor?.domain ? { ...anchor.domain } : {},
      context: typeof options.getContext === 'function' ? options.getContext() : {},
    };
  }

  function onContextMenu(event) {
    if (!devMode.value) return;

    const payload = buildPayload(event.target);
    if (!payload) return;

    event.preventDefault();
    event.stopPropagation();
    remarkPayload.value = payload;
    remarkDialogOpen.value = true;
  }

  onMounted(() => {
    loadManifest();
    document.addEventListener('contextmenu', onContextMenu, true);
  });

  onUnmounted(() => {
    document.removeEventListener('contextmenu', onContextMenu, true);
  });

  return {
    remarkDialogOpen,
    remarkPayload,
    reloadManifest: loadManifest,
  };
}
