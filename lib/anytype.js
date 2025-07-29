
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
    console.warn(`${method}: ${JSON.stringify(data)}`);
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
    return this.bodyReq('patch', path, data);
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
  async updateType (space, def) {
    return this.patch(`/spaces/${space}/types`, def);
  }
}

class AnytypeError extends Error {
  constructor ({ code, message, status, url }) {
    super(`[${status} ${code}] ${message} (${url})`);
  }
}


// curl -L 'http://127.0.0.1:31009/v1/spaces/bafyreigabkajnlqprbvbtc24o3ruaiwfxsh43dpn3a6bfjd7hcunxzqzle.12v07s6wed8gk/types' \
// -H 'Content-Type: application/json' \
// -H 'Accept: application/json' \
// -H 'Authorization: Bearer FStlBxdpk7fAFbepGvkvKkF6eJ+dIGG6RstXZAZBQWw=' \
// -d '{
//   "icon": {
//     "emoji": "📄",
//     "format": "emoji"
//   },
//   "key": "some_random_feed",
//   "layout": "profile",
//   "name": "Feed",
//   "plural_name": "Feeds",
//   "properties": [
//     {
//       "format": "url",
//       "key": "url",
//       "name": "URL"
//     },
//     {
//       "format": "text",
//       "key": "name",
//       "name": "Name"
//     }
//   ]
// }'

// {
//   "format": "url",
//   "key": "alternate",
//   "name": "Alternate"
// },
// {
//   "format": "date",
//   "key": "updated",
//   "name": "Last update"
// },
// {
//   "format": "objects",
//   "key": "entries",
//   "name": "Entries"
// }


// curl -X DELETE -L 'http://127.0.0.1:31009/v1/spaces/bafyreigabkajnlqprbvbtc24o3ruaiwfxsh43dpn3a6bfjd7hcunxzqzle.12v07s6wed8gk/types/bafyreig6vs277wbxqidiz3um6erw6v54yrjy4ctdc7k3c45eb22c5hmrne' \
// -H 'Authorization: Bearer FStlBxdpk7fAFbepGvkvKkF6eJ+dIGG6RstXZAZBQWw='
