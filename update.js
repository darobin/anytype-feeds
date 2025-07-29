#!/usr/bin/env node

import { resolve } from "node:path";
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
    const data = JSON.parse(await readFile(resolve(config)));
    const fm = new FeedManager(data);
    await fm.update(data.sources);
  })
;

program.parse();
