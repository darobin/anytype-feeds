
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
    if (!r.ok) {
      const message = await r.text();
      if (r.headers['content-type'] === 'application/json' || /^\s*\{/.test(message)) {
         throw new AnytypeError({ ...JSON.parse(message), url });
      }
      throw new AnytypeError({ code: r.statusText, message, status: r.status, url });
    }
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
  async bodyReq (method, path, data) {
    // console.warn(`${method}: ${JSON.stringify(data)}`);
    return this.req(`${base}${path}`, {
      method,
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify(data),
    });
  }
  async post (path, data) {
    return this.bodyReq('post', path, data);
  }
  async patch (path, data) {
    return this.bodyReq('PATCH', path, data); // uppercase because warning
  }
  async spaces () {
    return this.get(`/spaces`);
  }
  async types (space) {
    return this.get(`/spaces/${space}/types`);
  }
  async createType (space, def) {
    return this.post(`/spaces/${space}/types`, def);
  }
  async updateType (space, id, def) {
    return this.patch(`/spaces/${space}/types/${id}`, def);
  }
  async object (space, id) {
    return this.get(`/spaces/${space}/objects/${id}`);
  }
  async createObject (space, basics) {
    return this.post(`/spaces/${space}/objects`, basics);
  }
  async updateObject (space, id, details) {
    return this.patch(`/spaces/${space}/objects/${id}`, details);
  }
}

class AnytypeError extends Error {
  constructor ({ code, message, status, url }) {
    super(`[${status} ${code}] ${message} (${url})`);
  }
}
