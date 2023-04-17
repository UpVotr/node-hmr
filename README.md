# @upvotr/node-hmr

Hot module reloading for NodeJS with persistent values.

> A result of trying to develop NextJS applications with custom servers on a slow computer.

## Installation

npm

```
npm i @upvotr/node-hmr
```

yarn

```
yarn add @upvotr/node-hmr
```

> Warning: This module should _not_ be added to `devDependencies`, because if it is not installed, any modules that use it will encounter an error, unless you completely rewrite each one before releasing to production versions. See [Disabling HMR for Production](#disabling-hmr-for-production) for more information.

## Usage

> note: This module is _not_ intended for use when changing/updating modules in `node_modules`, and will not work correctly if you attempt to.

A minimal example:

```js
// index.js
const { HMRRuntime, FSWatcher } = require("@upvotr/node-hmr");

const runtime = new HMRRuntime(new FSWatcher(require), require);

async function main() {
  const a = await runtime.import("./a.js");

  a.exports.foo();

  runtime.on("update", (moduleId) => {
    if (moduleId === "./a.js") a.exports.foo();
  });
}

main();

// a.js
const {
  createModule,
  PersistManager,
  AsyncRunner,
  HMRRuntime,
  FSWatcher
} = require("@upvotr/node-hmr");

module.exports = createModule(
  new PersistManager(
    () => ({
      runtime: new HMRRuntime(new FSWatcher(require), require)
    }),
    ({ runtime }) => runtime.closeAll()
  ),
  new AsyncRunner(
    async ({ runtime }, emitUpdate) => {
      // Import the module with a mutating `exports` property
      const b = await runtime.import("./b.js");

      runtime.on("update", (id) => {
        if (id === "./b.js") {
          // The value of `b` mutates, so we don't need to worry about actually changing the exports.
          emitUpdate();
        }
      });

      return {
        foo: () => {
          b.exports.bar();
        }
      };
    },
    // Stop watching the file on cleanup, in case we are not importing it on the next run.
    ({ runtime }) => runtime.unimport("./b.js")
  ),
  // Do not update persistient values
  false
);

// b.js
const { createModule, PersistManager, Runner } = require("@upvotr/node-hmr");

module.exports = createModule(
  new PersistManager(),
  new Runner(() => ({ bar: () => console.log("bar") })),
  false
);
```

Running `node index.js` will run `main`, which listens for updates from the `a.js` file. Changing `"bar"` in `b.js` to a different value will automatically update the module, and it will be logged in the console again!

# API

#### `createModule(persist: PersistManager, runner: Runner | AsyncRunner, forceUpdate: boolean): HMRHodule`

The main way of creating an HMR-compatiable module. (You can still create the module definition object directly, see [HMRModule](#interface-hmrmodule))

- `persist` - A [`PersistManager`](#class-persistmanager) instance to manage persistient values that are costly to recreate or should not change such as runtimes, web servers, or compilers.
- `runner` - A [`Runner`](#class-runnerp-extends-recordstring-any-e) or [`AsyncRunner`](#class-asyncrunnerp-extends-recordstring-any-e) instance that handles the main module logic, including importing other HMR-enabled modules.

#### `class PersistManager<P extends Record<string, any>>`

Responsible for managing persistient values. Only values that should not be expected to change or use large amounts of resources to recreate should be used in this class. For example, if you are importing other HMR-enabled modules, you would want to give your `HMRRuntime` to this class, since it should not be changed, but you most likely do not want to call `HMRRuntime.import` here.

##### `constructor(generate?: () => P | Promise<P>, cleanup?: (values: P) => void | Promise<void>)`

- `generate` - Responsible for generating the persistient values when they are updated. runs once before the `runner` is called, and whenever the runtime is instructed to update the persistient values for the module.
- `cleanup` - Responsible for handling any cleanup that needs to be done before the persistient values are regenerated, such as closing web servers or closing watchers for a `HMRRuntime` via the `closeAll` method. Only called when the runtime is instructed to update the persistient values.

##### `generate(): P | Promise<P>`

Simply calls the passed `generate` function, and returns the generated values.

##### `cleanup(values: P): void | Promise<void>`

Simply calls the passed `cleanup` function.

#### `class Runner<P extends Record<string, any>, E>`

Responsible for managing any non-persistient values and generating the module's exports value.

##### `constructor(run: (persistientValues: P, emitUpdate: () => void) => E, cleanup?: (persistientValues: P, exports: E) => void)`

- `run` - Manages the main logic of the module, including using any persistien values it needs, and returns the module's exports value. Note: returning a `Promise` with this function will set the module's exports to a `Promise`. To use an async function in the runner to load other HMR-enabled modules, use [`AsyncRunner`](#class-asyncrunnerp-extends-recordstring-any-e).
  - `persistientValues` - The current values of the `PersistManager` being used in the module.
  - `emitUpdate` - Generally shouldn't be used, but is used to manually send an `update` event to the runtime that is currently managing the module, allowing the code that imported this module to hadle any changes it may need to make or call any functions that may have changed, as shown in the example.
- `cleanup` - Responsible for _undoing_ any actions that the `run` function may have made to the environment or persistientValues in preperation for the next call to the updated `run` function.

#### `class AsyncRunner<P extends Record<string, any>, E>`

An version of `Runner` that allows you to use an `async` run function without setting the module's exports to a promise. Especially useful when importing other HMR-enabled modules inside the `run` function.

##### `constructor(run: (persistientValues: P, emitUpdate: () => void) => Promise<E>, cleanup?: (persistientValues: P, exports: E) => void | Promise<void>)`

- `run` - Exactly the same as the `run` function in the synchronous `Runner` class, with the exception that it is an asynchronous function or should return a promise that resolves with the module's exports.
- `cleanup` - Again, exactly the same as in the `Runner` class, but if it returns a `Promise` the runtime will wait for it to resolve before calling the `run` function of the updated module.

#### `class HMRRuntime`

This class is responsible for handling pretty much everything to do with updating an HMR-enabled module.

Events:

- `update`
  - Parameters: [`id` - the module that was updated]

##### `constructor(watcher: Watcher | false, require: NodeJS.Require)`

- A [`Watcher`](#abstract-class-watcher) instance that manages watching for updates to modules, **_OR_** `false` to disable the watching function entirely (see [Disabling HMR for Production](#disabling-hmr-for-production)).
- `require` - A `NodeJS.Require` function that is used to resolve module paths and handel module imports and cache. See [`createSyntheticRequire`](#createsyntheticrequirerequire-id-string--any-realrequire-nodejsrequire-cache-any-resolve-nodejsrequireresolve) for importing ESM modules.

##### `async import<E = any>(id: string): Promise<{ exports: E | undefined }>`

Manages importing and updating a module with the given id/path.

- `id` - the path to the module to load
- `returns` - A `Promise` that resolves with an object containing a single `exports` property, or undefined.

The `exports` property of the returned object contains the return value of the module's runner. This property mutates when the module updates, so using object destructuring will prevent this update from happening. There are a couple of reasons for mutation instead of using another method such as a callback, the main one being that it makes the code a lot cleaner. Instead of needing to create a bunch of variables and update them every time, you just re-run the same exact line.

For example, here's a small example of a HMR-enabled `express` server that uses the mutating `exports` property in a route handler.

```js
// server.js
const express = require("express");
const { HMRRuntime, FSWatcher } = require("@upvotr/node-hmr");

const runtime = new HMRRuntime(new FSWatcher(require), require);

async function main() {
  const router = await runtime.import("./router.js");

  const app = express();

  app.use((...args) => router.exports(...args));

  app.listen(3000);
}

main();

//router.js
const { Router } = require("expresss");
const { createModule, PersistManager, Runner } = require("@upvotr/node-hmr");

module.exports = createModule(
  new PersistManager(),
  new Runner(() => {
    const router = Router();

    router.get("/ping", (req, res) => {
      res.send("pong");
    });

    return router;
  }),
  false
);
```

##### `unimport(id: string)`

Closes all watchers for the given module. Should be called when an update is made to a module where the imports might change.

##### `closeAll()`

Closes all watchers for all modules.

#### `abstract class Watcher`

Base class definition for watching modules for changes.

- `abstract watch(id: string): () => void` - The only method used in this class. The value of `id` is the resolved module path used for indexing the require cache. Must return a function that takes no parameters and ends teh watching process.

Events:

- `update`
  - Parameters: [`id` - the module id to update]

Provided watchers:

- `FSWatcher(require)` - Uses `fs.watch` to detect file change updates, with a timeout to prevent a double event (which occurs based on the os) from causing rapid updates. Must be passed the `require` function (or a synthetic require) for path resolution.
- `NoopWatcher` - an alternative to passing `false` as the watcher option to the runtime.

Example custom watcher (TypeScript):

```ts
import { Watcher } from "@upvotr/node-hmr";
import { watch } from "fs";
import { readFile } from "fs/promises";
import md5 from "md5";

/**
 * File watcher for `@upvotr/node-hmr` that only updates if a file's content has changed.
 */
export class ContentWatcher extends Watcher {
  constructor(private require: NodeJS.Require) {
    super();
  }

  watch(id: string): () => void {
    // Save the md5 signature of the file from the last time it was changed
    let previousMd5: string;
    // timeout to prevent double even emitting
    let timeout: NodeJS.Timeout;
    // The absolute file path of the requested module
    const resolvedPath = this.require.resolve(id);
    // Watch the file for changes
    const watcher = watch(resolvedPath, "utf-8", (e) => {
      // We only need to listen to change events
      if (e === "change") {
        // Clear the previous timeout if it has not already finished
        clearTimeout(timeout);
        // set the new timeout to read the file and check for changes
        timeout = setTimeout(async () => {
          // file buffer
          const content = await readFile(resolvedPath);
          const currentMd5 = md5(content, {
            asString: true
          });

          if (currentMd5 !== previousMd5) {
            this.emit("update", id);
            // Save the md5 hash for future comparisons
            previousMd5 = currentMd5;
          }
        }, 100);
      }
    });

    return () => watcher.close();
  }
}
```

#### `createSyntheticRequire(require: (id: string) => any, realRequire: NodeJS.Require, cache?: any, resolve?: NodeJS.RequireResolve)`

> Warning: This is an _experimental_ feature that may be removed in future versions, or completely overhauled.

This function creates a sort of mocked require function that can be used to modify imports. A great example of when you may want to use this is if you want to use this module with ESM exports. For example, if, in the example, you used `export default` and were working in a project with `"type": "module"`, the runtime would have no clue how to handle this new format, and even using the `createRequire` function provided by NodeJS's `module` module will not work, because it cannot import ESM. This is where this function comes in. Using this function, you can use a module such as `jiti` to synchronously import the modules. Example:

```ts
import { fileURLToPath } from "url";
import { createRequire } from "module";
import createJITIRequire from "jiti";
import { createSyntheticRequire } from "@upvotr/node-hmr";

const realRequire = createRequire(import.meta.url);
const jiti = createJITIRequire(fileURLToPath(import.meta.url));
const syntheticRequire = createSyntheticRequire(
  (id: string) => jiti(id).default /* The default export is the HMRModule */,
  require,
  jiti.cache
);

const runtime = new HMRRuntime(new Watcher(), syntheticRequire);

// esm.mjs
import { createModule, PersistManager, Runner } from "@upvotr/node-hmr";

export default createModule(
  new PersistManager(),
  new Runner(() => {
    console.log("Running from an ES Module!");
  })
);

// typescript.ts
// Thanks to jiti, you can import typescript files, too!
import { createModule, PersistManager, Runner } from "@upvotr/node-hmr";

export default createModule(
  new PersistManager(),
  new Runner(() => {
    console.log("Running from a TypeScript Module!" as string);
  })
);
```

## Types

> A note on usage with TypeScript:
>
> TypeScript does not automatically detect a module's type when using `module.exports = createModule(...)`. To enable type inferencing and the `ExportType` type, use `export = createModule(...)` instead, or see [`createSyntheticRequire`](#createsyntheticrequirerequire-id-string--any-realrequire-nodejsrequire-cache-any-resolve-nodejsrequireresolve) to use `export default`.

#### `interface HMRModule`

This is the main structure used by the runtime to handle updating modules.

Properties:

- `updatePersistientValues: boolean` - tells the runtime if it should clean up the old persistient values and regenerate new ones.
- `persist: PersistManager`
- `runner: Runner | AsyncRunner`

#### `ExportType<M extends HotModule<any, any>>`

Used to automatically configure the return type for an HMR-enabled module.
Example usage:

```ts
const mod = await runtime.import<ExportType<typeof import("./path/to/module")>>(
  "./path/to/module"
);
```

## Disabling HMR for Production

HMR is extremely useful for development, but in production builds it is an unnecessary use of resources. This module was designed with this in mind, and there are two ways to disable it: Either pass `false` for the `watcher` parameter for each runtime (reccomended), or use the provided `NoopWatcher` watcher. Example:

```js
// Because the `&&` operator returns either the first falsy value or the last value, this will evaluate to `false` if `NODE_ENV` is anything but "development", and will return a watcher otherwise.
const runtime = new HMRRuntime(
  process.env.NODE_ENV === "development" && new Watcher(),
  require
);
```

## Error Handling

You're never going to be perfect. Sometimes you'll have a syntax error, or some small issue you forgot to fix. However, you don't want one of these small issues to completely destroy your development process by having to pause to restart the server. This module attempts to prevent this from happening. If a module encounters an error when the runner is called, the runtime notices this error, and attemps to reinstate the module by calling a chached runner from the previous time it was imported and run without an error, and will log a warning to the console. If the module has _not_ been cached, as this was the first import, _or_ the last cached version produces an error, _then_ the runtime will throw an error.
