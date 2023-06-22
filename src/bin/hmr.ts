#!/usr/bin/env node

import { resolve } from "path";
import HMRRuntime, { FSWatcher, Watcher, runtime as r, synthetic } from "..";
import yargs, { boolean } from "yargs";
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
      describe: "The file containing the module to run.",
      type: "string"
    },
    n: {
      alias: "noWatch",
      describe: "Completely disable watching, suitable for production runs.",
      type: "boolean"
    },
    l: {
      alias: "enableLogging",
      describe: "Enable module update logging.",
      type: "boolean"
    },
    r: {
      alias: "require",
      describe: "Path to a file with a default export of a NodeJS.Require.",
      type: "string"
    }
  })
  .help()
  .parseSync();

const requireFn = args.r ? require(resolve(process.cwd(), args.r)) : require;

if (typeof requireFn !== "function")
  throw new TypeError("Invalid require function passed.");

const req = synthetic(requireFn, requireFn, requireFn.cache, (url: string) =>
  resolve(process.cwd(), url)
);

let watcher: Watcher;

if (args.w) {
  const watcherFile = resolve(process.cwd(), args.w);
  const watcherClass = req(watcherFile);
  if (!("constructor" in watcherClass))
    throw new TypeError("Specified watcher file's export is not a class.");
  watcher = new watcherClass(req);
  if (!(watcher instanceof Watcher))
    throw new TypeError("Specified watcher file's export is not a watcher.");
} else {
  watcher = new FSWatcher(req);
}

if (args.l) {
  HMRRuntime.setLogging(true);
}

if (!!args.n) {
  HMRRuntime.disableWatching();
}

r(req, watcher).import(args.f);
