#!/usr/bin/env node

import { resolve, dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { program } from 'commander';
import { FeedManager } from "./lib/feeds.js";
import makeRel from './lib/rel.js';

const rel = makeRel(import.meta.url);
const { version, description } = JSON.parse(await readFile(rel('./package.json')));

program
  .name('update-anytype-feeds')
  .description(description)
  .version(version)
;

program
  .argument('<config>', 'path to configuration')
  .action(async (config) => {
    const configPath = resolve(config);
    const cachePath = join(dirname(configPath), 'cache.json');
    const data = JSON.parse(await readFile(configPath));
    const fm = new FeedManager({ ...data, cachePath });
    await fm.update(data.sources);
  })
;

program.parse();
