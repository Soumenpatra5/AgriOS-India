import { getIdToken } from "./auth.js";

export async function authFetch(url, options = {}) {
  const token = await getIdToken();
  const headers = { ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  let signal = options.signal;
  let timeoutId;
  
  if (!signal && options.timeout !== false) {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 10000);
    signal = controller.signal;
  }
  
  try {
    return await fetch(url, { ...options, headers, signal });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
