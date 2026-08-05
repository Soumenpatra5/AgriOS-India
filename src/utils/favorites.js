import { storage } from "./storage.js";

const KEY = "favorites";

export function getFavorites() {
  return storage.get(KEY, []);
}

export function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  storage.set(KEY, favs);
  return favs;
}

export function isFavorite(id) {
  return getFavorites().includes(id);
}
