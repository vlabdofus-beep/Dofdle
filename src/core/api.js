// Client minimal pour l'API DofusDB (style FeathersJS).
// Fonctionne dans le navigateur ET dans Node 18+ (fetch global) : utilisé par
// le jeu (chargement à la volée) et par scripts/build-data.mjs (snapshot).

export const API_BASE = 'https://api.dofusdb.fr';
export const PAGE_SIZE = 50; // plafond imposé par l'API

/**
 * Construit une query string Feathers.
 * { '$select': ['id','name'], 'id[$in]': [1,2], 'isBoss[$ne]': true }
 * -> $select[]=id&$select[]=name&id[$in][]=1&id[$in][]=2&isBoss[$ne]=true
 */
export function buildQuery(params = {}) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) parts.push(`${key}[]=${encodeURIComponent(v)}`);
    } else {
      parts.push(`${key}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join('&');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createApi({ base = API_BASE, concurrency = 6, onRequest } = {}) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || !queue.length) return;
    active++;
    const { task, resolve, reject } = queue.shift();
    task().then(resolve, reject).finally(() => { active--; next(); });
  };
  const schedule = (task) => new Promise((resolve, reject) => { queue.push({ task, resolve, reject }); next(); });

  async function get(path, params = {}) {
    const url = `${base}/${path}?${buildQuery(params)}`;
    return schedule(async () => {
      let lastErr;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch(url);
          if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
          if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} sur ${path}`), { fatal: true });
          const json = await res.json();
          onRequest?.(path);
          return json;
        } catch (e) {
          lastErr = e;
          if (e.fatal) throw e;
          await sleep(400 * 2 ** attempt);
        }
      }
      throw lastErr;
    });
  }

  /** Récupère toutes les pages d'une ressource (tri par id pour la stabilité). */
  async function getAll(path, params = {}, { onProgress } = {}) {
    const base = { ...params, '$limit': PAGE_SIZE, '$sort[id]': 1 };
    const first = await get(path, { ...base, '$skip': 0 });
    const total = first.total ?? first.data.length;
    const pages = Math.ceil(total / PAGE_SIZE);
    let done = 1;
    onProgress?.(done, pages);
    const rest = [];
    for (let p = 1; p < pages; p++) {
      rest.push(get(path, { ...base, '$skip': p * PAGE_SIZE }).then((r) => { onProgress?.(++done, pages); return r.data; }));
    }
    const all = first.data.concat(...(await Promise.all(rest)));
    // Dédoublonnage défensif (si la base bouge pendant la pagination)
    const seen = new Set();
    return all.filter((x) => (seen.has(x.id) ? false : seen.add(x.id)));
  }

  /** Récupère une liste d'ids par lots de 50 via id[$in]. */
  async function getByIds(path, ids, params = {}, { onProgress } = {}) {
    const unique = [...new Set(ids)].filter((x) => x !== undefined && x !== null);
    const chunks = [];
    for (let i = 0; i < unique.length; i += PAGE_SIZE) chunks.push(unique.slice(i, i + PAGE_SIZE));
    let done = 0;
    const res = await Promise.all(chunks.map((chunk) =>
      get(path, { ...params, 'id[$in]': chunk, '$limit': PAGE_SIZE }).then((r) => { onProgress?.(++done, chunks.length); return r.data; })));
    return res.flat();
  }

  return { get, getAll, getByIds };
}
