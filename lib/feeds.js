
import { deepStrictEqual } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import chalk from "chalk";
import Parser from "rss-parser";
import Anytype from "./anytype.js";

const FeedType = {
  icon: {
    emoji: '🛜',
    format: 'emoji',
  },
  key: 'supramundane_feed',
  layout: 'profile',
  name: 'Feed',
  plural_name: 'Feeds',
  properties: [
    {
      format: 'url',
      key: 'url',
      name: 'URL',
    },
    {
      format: 'text',
      key: 'name',
      name: 'Name',
    },
    {
      format: 'url',
      key: 'alternate',
      name: 'Alternate',
    },
    // Need to figure that out somehow
    // {
    //   format: 'object',
    //   key: 'author',
    //   name: 'Author',
    // },
    // Also: generator, id
    {
      format: 'objects',
      key: 'entries',
      name: 'Entries',
    },
  ],
};

const WebThingType = {
  icon: {
    emoji: '📄',
    format: 'emoji',
  },
  key: 'supramundane_web_thing',
  layout: 'note',
  name: 'Web Thing',
  plural_name: 'Web Things',
  properties: [
    {
      format: 'url',
      key: 'url',
      name: 'URL',
    },
    {
      format: 'text',
      key: 'name',
      name: 'Name',
    },
    {
      format: 'text',
      key: 'description',
      name: 'Description',
    },
    // XXX we could use `files` to make this a tile and then have a tile renderer
    // or even just a fake file format that's just a text or JSON with the URL
    // and that loads in a "tab".
    // XXX Would also be good to have a parent Feed but not sure if that's a thing.
  ],
}

export class FeedManager {
  #any;
  #space;
  #cache;
  #cachePath;
  #debug;
  constructor (c, ) {
    const missing = ['apiKey', 'space'].filter(k => !c[k]);
    if (missing.length) throw new Error(`Required: ${missing.join(', ')}.`);
    this.#any = new Anytype(c.apiKey);
    this.#space = c.space;
    this.#cache = {};
    this.#cachePath = c.cachePath;
    this.#debug = c.logLevel === 'info';
    this.parser = new Parser();
  }
  async update (sources) {
    try {
      if (this.#cachePath) this.#cache = JSON.parse(await readFile(this.#cachePath));
      this.progress(`Checking that space '${this.#space}' exists.`)
      const spaces = await this.#any.spaces();
      const space = spaces.find(s => s.name === this.#space);
      if (!space) {
        this.error(`Space '${this.#space}' not found.`);
        return;
      }
      const spaceID = space.id;

      this.progress(`Listing types.`)
      const types = await this.#any.types(spaceID);
      const feedType = types.find(f => f.key === FeedType.key);
      await this.createOrUpdateType(spaceID, FeedType, feedType);
      const webThingType = types.find(f => f.key === WebThingType.key);
      await this.createOrUpdateType(spaceID, WebThingType, webThingType);

      this.progress(`Processing sources.`)
      await Promise.all(sources.map(s => this.updateFromSource(spaceID, s)));
    }
    catch (e) {
      console.error(e);
      this.error(e.message);
    }
  }
  // feedUrl: 'https://www.reddit.com/.rss'
  // title: 'reddit: the front page of the internet'
  // description: ""
  // link: 'https://www.reddit.com/'
  // items:
  //     - title: 'The water is too deep, so he improvises'
  //       link: 'https://www.reddit.com/r/funny/comments/3skxqc/the_water_is_too_deep_so_he_improvises/'
  //       pubDate: 'Thu, 12 Nov 2015 21:16:39 +0000'
  //       creator: "John Doe"
  //       content: '<a href="http://example.com">this is a link</a> &amp; <b>this is bold text</b>'
  //       contentSnippet: 'this is a link & this is bold text'
  //       guid: 'https://www.reddit.com/r/funny/comments/3skxqc/the_water_is_too_deep_so_he_improvises/'
  //       categories:
  //           - funny
  //       isoDate: '2015-11-12T21:16:39.000Z'
  async updateFromSource (space, src) {
    const feed = await this.parser.parseURL(src);
    const objectIDs = [];
    for (const item of feed.items) {
      const key = item.guid || item.link;
      if (!key) {
        this.warn(`No link or GUID for object in '${src}'`);
        continue;
      }
      // We have to manage our own cache because Anytype sets its own IDs and
      // lacks powerful-enough search to get an object by your own key.
      if (this.#cache[key]) continue; // we don't do updates for now
      let obj = await this.#any.createObject(space, { name: item.title, type_key: 'supramundane_web_thing' });
      const properties = [];
      if (key) properties.push({ key: 'url', url: key });
      // XXX we need to find another field name for this, and 'updated' also maps wrong
      // if (item.isoDate) properties.push({ key: 'last_updated', date: item.isoDate });
      if (item.contentSnippet) properties.push({ key: 'description', text: item.contentSnippet });
      console.warn(JSON.stringify(properties));
      obj = await this.#any.updateObject(space, obj.id, { name: item.title, properties });
      this.progress(`Added Web Thing [${obj.id}] ${key}`);
      objectIDs.push(obj.id);
      this.#cache[key] = obj.id;
      await this.writeCache();
    }
    let feedObj;
    if (this.#cache[src]) {
      feedObj = await this.#any.object(space, this.#cache[src]);
    }
    else {
      feedObj = await this.#any.createObject(space, { name: feed.title, type_key: 'supramundane_feed' });
    }
    // entries
    const objects = feedObj.properties.find(p => p.key === 'entries')?.objects;
    if (objects) objectIDs.push(...objects);
    const properties = [];
    if (src) properties.push({ key: 'url', url: src });
    if (feed.description) properties.push({ key: 'description', text: feed.description });
    if (objectIDs.length) properties.push({ key: 'entries', objects: [...new Set(objectIDs)] });
    feedObj = await this.#any.updateObject(space, feedObj.id, { name: feed.title, properties });
    this.progress(`Added Feed [${feedObj.id}] ${feed.title}`);
    this.#cache[src] = feedObj.id;
    await this.writeCache();
  }
  async writeCache () {
    if (this.#cachePath) await writeFile(this.#cachePath, JSON.stringify(this.#cache, null, 2));
  }
  async createOrUpdateType(space, def, cur) {
    this.progress(`Creating/updating type [${def.icon.emoji}] ${def.name}`);
    if (!cur) {
      this.progress(`  • Did not exist, creating.`);
      return await this.#any.createType(space, def);
    }
    // The docs mention that a type can be archived in the response, but never set.
    // This is probably to be looked at later.
    try {
      const hideDefaultProps = new Set(['tag', 'backlinks', 'last_update', 'language']);
      const copy = structuredClone(cur);
      delete copy.id;
      delete copy.archived;
      delete copy.object;
      copy.properties = copy.properties?.filter(p => !hideDefaultProps.has(p.key));
      copy.properties?.forEach(p => {
        delete p.id;
        delete p.object;
      });
      deepStrictEqual(def, copy);
      this.progress(`  • Already present and up to date.`);
      // if you get here, no further action is required — they are identical
    }
    catch (e) {
      this.progress(`  • Existed but needs updating.`);
      console.warn(e);
      this.#any.updateType(space, cur.id, def);
    }
  }
  error (str) {
    console.error(chalk.red(str));
  }
  warn (str) {
    console.error(chalk.yellow(str));
  }
  progress (str) {
    if (this.#debug) console.warn(chalk.blue(str));
  }
}
