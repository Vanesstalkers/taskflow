import { computed } from 'vue';
import { isTaskFieldDisabled } from '../utils/taskFieldAccess.js';
import { useResolvedTaskAccessPath } from './taskFieldAccessContext.js';

/**
 * disabled с учётом props.disabled, accessPath и provide taskFieldAccess.
 * @param {{ disabled?: boolean, accessPath?: string, field?: string }} props
 */
export function useTaskFieldDisabled(props) {
  const resolvedAccessPath = useResolvedTaskAccessPath(props);

  return computed(
    () =>
      Boolean(props.disabled) ||
      (resolvedAccessPath.value ? isTaskFieldDisabled(resolvedAccessPath.value) : false),
  );
}
