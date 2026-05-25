import { computed } from 'vue';
import { isTaskFieldDisabled } from '../utils/taskFieldAccess.js';

/**
 * @param {import('vue').Ref | { disabled?: boolean, accessPath?: string }} props
 */
export function useFieldDisabled(props) {
  return computed(
    () => Boolean(props.disabled) || (props.accessPath ? isTaskFieldDisabled(props.accessPath) : false),
  );
}
