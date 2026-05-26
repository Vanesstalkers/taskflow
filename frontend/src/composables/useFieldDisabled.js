import { useTaskFieldDisabled } from './useTaskFieldDisabled.js';

/** @deprecated Используйте useTaskFieldDisabled (поддерживает provide/inject). */
export function useFieldDisabled(props) {
  return useTaskFieldDisabled(props);
}
