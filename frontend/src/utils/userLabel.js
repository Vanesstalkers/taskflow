/** Убирает уже вшитое ФИО из значения login (`admin (ФИО)` → `admin`). */
export function normalizeUserLogin(value) {
  const s = String(value ?? '').trim();
  const idx = s.indexOf(' (');
  return idx > 0 ? s.slice(0, idx).trim() : s;
}

/** Из строки поиска `login (ФИО)` извлекает логин. */
export function loginFromSearchTitle(title) {
  return normalizeUserLogin(title);
}

/** Из строки поиска `login (ФИО)` извлекает ФИО. */
export function fioFromSearchTitle(title) {
  const s = String(title ?? '').trim();
  const start = s.indexOf(' (');
  if (start < 0 || !s.endsWith(')')) return '';
  return s.slice(start + 2, -1).trim();
}

/** Подпись пользователя: `login (ФИО)` — как `user.search.title` на backend. */
export function formatUserLabel(user, store) {
  if (!user || typeof user !== 'object') return '';
  const login = normalizeUserLogin(user.login);
  const displayTitle = String(user.displayTitle ?? '').trim();
  const ppId = Object.keys(user.pp || {}).find(Boolean);
  const pp = ppId && store?.pp?.[ppId] ? store.pp[ppId] : null;
  const fioFromPp = pp
    ? [pp.lastName, pp.firstName, pp.middleName]
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(' ')
    : '';
  const fio =
    fioFromPp ||
    String(user._fio ?? '').trim() ||
    fioFromSearchTitle(displayTitle);

  if (login && fio) return `${login} (${fio})`;
  if (login) {
    if (displayTitle && displayTitle !== login) return displayTitle;
    return login;
  }
  if (fio) return fio;
  if (displayTitle) return displayTitle;
  return String(user._id || '').trim();
}

/** Проверяет, подходит ли пользователь под строку поиска (login, ФИО, displayTitle). */
export function userMatchesSearchQuery(user, query, store) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  if (!user || typeof user !== 'object') return false;

  const login = normalizeUserLogin(user.login).toLowerCase();
  const displayTitle = String(user.displayTitle ?? '').trim().toLowerCase();
  const label = formatUserLabel(user, store).toLowerCase();
  const fio =
    String(user._fio ?? '').trim().toLowerCase() ||
    fioFromSearchTitle(user.displayTitle).toLowerCase();

  return [login, displayTitle, label, fio].some((part) => part && part.includes(q));
}
