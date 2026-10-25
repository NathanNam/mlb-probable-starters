/** fetch + JSON that fails loudly on non-2xx responses instead of parsing an error page. */
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}
