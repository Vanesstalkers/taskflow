const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function mergeDeep({ target, source }) {
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (!targetValue) {
      if (sourceValue !== null) {
        if (isObject(sourceValue)) {
          target[key] = {};
          mergeDeep({ target: target[key], source: sourceValue });
        } else {
          target[key] = sourceValue;
        }
      }
    } else if (
      typeof targetValue !== typeof sourceValue ||
      targetValue === null ||
      sourceValue === null
    ) {
      if (sourceValue === null) {
        delete target[key];
      } else {
        target[key] = sourceValue;
      }
    } else if (Array.isArray(targetValue)) {
      if (sourceValue === null) {
        delete target[key];
      } else {
        target[key] = sourceValue;
      }
    } else if (isObject(targetValue)) {
      if (sourceValue === null) {
        delete target[key];
      } else {
        if (!target[key]) target[key] = {};
        mergeDeep({ target: target[key], source: sourceValue });
      }
    } else if (targetValue !== sourceValue) {
      if (sourceValue === null) {
        delete target[key];
      } else {
        target[key] = sourceValue;
      }
    }
  }
}

export { mergeDeep };
