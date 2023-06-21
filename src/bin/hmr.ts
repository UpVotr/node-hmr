#!/usr/bin/env node

import { resolve } from "path";
import HMRRuntime, { FSWatcher, Watcher, runtime as r, synthetic } from "..";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const args = yargs(hideBin(process.argv))
  .options({
    w: {
      alias: "watcher",
      describe:
        "Path to the module with the watcher to use. Default uses the builtin FSWatcher.",
      type: "string"
    },
    f: {
      alias: "file",
      demandOption: true,
      describe: "The file containing the module to run",
      type: "string"
    },
    n: {
      alias: "noWatch",
      describe: "Completely disable watching, suitable for production runs.",
      type: "boolean"
    }
  })
  .help()
  .parseSync();

const req = synthetic(require, require, null, (url: string) =>
  resolve(__dirname, url)
);

let watcher: Watcher;

if (args.w) {
  const watcherFile = resolve(__dirname, args.w);
  const watcherClass = require(watcherFile);
  if (!("constructor" in watcherClass))
    throw new TypeError("Specified watcher file's export is not a class.");
  watcher = new watcherClass(req);
  if (!(watcher instanceof Watcher))
    throw new TypeError("Specified watcher file's export is not a watcher.");
} else {
  watcher = new FSWatcher(req);
}

if (!!args.n) {
  HMRRuntime.disableWatching();
}

r(req, watcher).import(args.f);
