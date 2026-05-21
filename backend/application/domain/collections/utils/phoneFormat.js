({
  digitsOnly(value) {
    return String(value ?? '').replace(/\D/g, '');
  },

  formatNational(number) {
    const n = this.digitsOnly(number).slice(0, 10);
    if (!n) return '';
    if (n.length <= 3) return `(${n}`;
    if (n.length <= 6) return `(${n.slice(0, 3)}) ${n.slice(3)}`;
    if (n.length <= 8) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8, 10)}`;
  },

  /** Полный вид для поиска и вкладок: +7 (900) 123-45-67 */
  formatDisplay(document) {
    const code = this.digitsOnly(document?.code).slice(0, 4) || '7';
    const national = this.formatNational(document?.number);
    if (!national) return `+${code}`;
    return `+${code} ${national}`;
  },
});
