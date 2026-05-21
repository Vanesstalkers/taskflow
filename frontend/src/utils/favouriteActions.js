import { getApi } from '../main.js';

/** Идентификатор цели для избранного-реестра (список коллекции). */
export const REGISTRY_TARGET_ID = 'list';

export function normalizeMdiIcon(icon) {
  const raw = String(icon || '').trim();
  if (!raw) return 'mdi-star';
  if (raw.startsWith('mdi-')) return raw;
  return `mdi-${raw}`;
}

export async function addFavourite({ title, icon, targetKind, targetCollection, targetId }) {
  const method = getApi()?.favourites?.addFavourite;
  if (!method) throw new Error('API favourites.addFavourite недоступен');
  const kind = String(targetKind || '').trim();
  const collection = String(targetCollection || '').trim();
  const id = kind === 'registry' ? REGISTRY_TARGET_ID : String(targetId || '').trim();
  const response = await method({
    title,
    icon: normalizeMdiIcon(icon),
    targetKind: kind,
    targetCollection: collection,
    targetId: id,
  });
  if (response?.status !== 'ok') throw new Error('Не удалось добавить в избранное');
  return response;
}

export async function removeFavourite(_id) {
  const method = getApi()?.favourites?.removeFavourite;
  if (!method) throw new Error('API favourites.removeFavourite недоступен');
  const response = await method({ _id });
  if (response?.status !== 'ok') throw new Error('Не удалось удалить из избранного');
  return response;
}
