import { getBackendState } from "./backend.js";
import { mergeDeep } from "../utils/mergeDeep.js";

let isSubscribed = false;

const applyStorePatch = (patch) => {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
  if (!window.store || typeof window.store !== "object") return;
  mergeDeep({ target: window.store, source: patch });
};

const subscribeStoreUpdates = async () => {
  if (isSubscribed) return;
  const backend = getBackendState();
  if (!backend) return;
  const { api } = backend;
  if (!api?.core?.on) return;

  // Expected event payload: { [collection]: { [id]: { ... } } }
  api.core.on("updateStore", applyStorePatch);

  isSubscribed = true;
};

export { subscribeStoreUpdates, applyStorePatch };
