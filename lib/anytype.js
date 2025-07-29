
const base = "http://localhost:31009/v1";

export default class Anytype {
  #apiKey;
  constructor (apiKey) {
    this.#apiKey = apiKey;
  }
  headers (more = {}) {
    return {
      accept: 'application/json',
      authorization: `Bearer ${this.#apiKey}`,
      ...more,
    };
  }
  async req (url, options, paginatedData) {
    const r = await fetch(url, options);
    if (!r.ok) throw new AnytypeError(await r.json());
    const res = await r.json();
    if (res.pagination) {
      if (!paginatedData) paginatedData = [];
      paginatedData.push(...res.data);
      if (res.pagination.has_more) {
        const u = new URL(url);
        const usp = u.searchParams;
        usp.set('offset', res.pagination.offset + res.pagination.limit);
        return await this.req(u.toString(), options, paginatedData);
      }
      else {
        return paginatedData;
      }
    }
    else {
      const keys = Object.keys(res);
      // This is a future footgun, but it's also very annoying that they're all self-namespaced.
      if (keys.length === 1) return res[keys[0]];
      return res;
    }
  }
  async get (path) {
    return this.req(`${base}${path}`, { headers: this.headers() });
  }
  async spaces () {
    return this.get(`/spaces`);
  }
}

class AnytypeError extends Error {
  constructor ({ code, message, status }) {
    super(`[${status} ${code}] ${message}`);
  }
}
