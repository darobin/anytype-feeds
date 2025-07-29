
import chalk from "chalk";
import Anytype from "./anytype.js";

// "space": "XXX",
// "sources": [
//   "https://berjon.com/feed.atom"
// ],
// "logLevel": "info"

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
      console.warn(JSON.stringify(spaces, null, 2));
      const space = spaces.find(s => s.name === this.#space);
      if (!space) {
        this.error(`Space '${this.#space}' not found.`);
        return;
      }

      this.progress(`Listing types.`)

      // - list types
      // - create Feed type if it doesn't exist (or maybe update it otherwise?)
      // - create FeedPost type if it doesn't exist (or update?)
      // - fetch RSS & parse
      // - for the feed itself, generate an ID (based on the URL) and get/create the object
      // - for each entry, gen ID, get/create, set feed as parent
      // - collection?
    }
    catch (e) {
      this.error(e.message);
    }
  }
  error (str) {
    console.error(chalk.red(str));
  }
  progress (str) {
    if (this.#debug) console.warn(chalk.blue(str));
  }
}
