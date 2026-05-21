/** Только цифры из строки. */
export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export const NATIONAL_MAX = 10;
export const CODE_MAX = 4;
export const DEFAULT_CODE = '7';

/** Маска кода: +375; при пустом значении — '' (плейсхолдер задаётся в UI) */
export function formatCode(code) {
  const c = digitsOnly(code).slice(0, CODE_MAX);
  return c ? `+${c}` : '';
}

/** Из +375 → 375 */
export function parseCode(display) {
  return digitsOnly(display).slice(0, CODE_MAX);
}

/** Маска номера без кода: (900) 123-45-67 */
export function formatNational(number) {
  const n = digitsOnly(number).slice(0, NATIONAL_MAX);
  if (!n) return '';
  if (n.length <= 3) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 3)}) ${n.slice(3)}`;
  if (n.length <= 8) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8, NATIONAL_MAX)}`;
}

/** Из маски → 9001234567 */
export function parseNational(display) {
  return digitsOnly(display).slice(0, NATIONAL_MAX);
}
