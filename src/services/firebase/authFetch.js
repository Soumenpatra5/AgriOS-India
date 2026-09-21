import { getIdToken } from "./auth.js";

export async function authFetch(url, options = {}) {
  const token = await getIdToken();
  const headers = { ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}
