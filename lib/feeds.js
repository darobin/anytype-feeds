
import { deepStrictEqual } from "node:assert";
import chalk from "chalk";
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
    {
      format: 'date',
      key: 'updated',
      name: 'Last update',
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
      format: 'date',
      key: 'updated',
      name: 'Last update',
    },
    {
      format: 'text',
      key: 'description',
      name: 'Description',
    },
    {
      format: 'text',
      key: 'lang',
      name: 'Language', // should probably be a select
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
  #debug;
  constructor (c) {
    const missing = ['apiKey', 'space'].filter(k => !c[k]);
    if (missing.length) throw new Error(`Required: ${missing.join(', ')}.`);
    this.#any = new Anytype(c.apiKey);
    this.#space = c.space;
    this.#debug = c.logLevel === 'info';
  }
  async update () {
    try {
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

      // - fetch RSS & parse
      // - for the feed itself, generate an ID (based on the URL) and get/create the object
      // - for each entry, gen ID, get/create, set feed as parent
      // - collection?
    }
    catch (e) {
      console.error(e);
      this.error(e.message);
    }
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
      const copy = structuredClone(cur);
      delete copy.id;
      delete copy.archived;
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
      this.#any.updateType(space, def);
    }
  }
  error (str) {
    console.error(chalk.red(str));
  }
  progress (str) {
    if (this.#debug) console.warn(chalk.blue(str));
  }
}
