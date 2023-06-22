# @upvotr/node-hmr

Hot module reloading for NodeJS with persistent values.

> A result of trying to develop NextJS applications with custom servers on a slow computer.

## Installation

### Warning: Do _not_ use versions `2.0.13` through `2.0.21`. They are all broken in some way.

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
const { createRuntime } = require("@upvotr/node-hmr");

const runtime = createRuntime(require);

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
  hmr,
  createPersist,
  createRunner,
  createRuntime
} = require("@upvotr/node-hmr");

module.exports = hmr(
  createPersist(
    () => ({
      runtime: new HMRRuntime(new FSWatcher(require), require)
    }),
    ({ runtime }) => runtime.closeAll()
  ),
  createRunner(
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
    ({ runtime }) => runtime.unimport("./b.js"),
    // Mark it as an AsyncRunner
    true
  )
);

// b.js
const { hmr, createRunner } = require("@upvotr/node-hmr");

module.exports = hmr(
  null,
  createRunner(() => ({ bar: () => console.log("bar") }))
);
```

Running `node index.js` will run `main`, which listens for updates from the `a.js` file. Changing `"bar"` in `b.js` to a different value will automatically update the module, and it will be logged in the console again!

For more simple examples, see the [`examples`](https://github.com/UpVotr/node-hmr/tree/main/examples) folder.

For a significantly more advanced example, check out the [UpVotr source code](https://github.com/UpVotr/UpVotr/blob/main/server/src/server.ts).

## Use-case

Modern websites tend to be extremely complex. Some require bundlers to not only reduce file sizes, but also handle compilers and other features such as allowing scripts to import assets directly. However, bundlers such as Webpack tend to be relatively resource-heavy, and a single change can require many other files to change. That's all fine when you are using their provided HMR with `devServer`, but what if you are bundling or compiling your _server_ as well, not just the client? Some tools have been created for this, such as `nodemon` (now integrated directly into node with the `--watch` flag) and [`node-hmr`](https://www.npmjs.com/package/node-hmr), which is very similar to this module. Now, `node-hmr` might work for you, and you may like it better. However, the way in which it was set up was callback based, something I'm not a huge fan of. The biggest issue with `node-hmr` is that there is no easy way to set up "persistent" values that require a lot of power to start up, such as a `next` compiler. This is somewhat related to the issues mentioned in the [limitations section](https://www.npmjs.com/package/node-hmr#limitations) of it's readme. This module also lacks a way to disable the HMR system without having to rewrite the code, and leaving it in production will create all of the file watching processes regardless. That is where this module comes in.

## Core concepts

### Persistent values

The biggest difference between this and other modules is the use of persistient values.

These persistient variables are completely controlled by you, the developer, from creation to use to cleanup. You are responsible for removing any code that may have polluted global scope, remove any event handlers, etc.

Persistient values can significantly lessen the load of developing an application by keeping values that are not expected to change from being recreated unless specifically forced to. Some examples of what you might want to use as persistient values include:

- **Database connections** - Especially if they are hosted remotely, disconnecting and reconnecting to a database every time you change your server's code can take up valuable time in the long run.
- **Programmatically created compilers or bundlers** - Compilers generally have to compile the entire application every time they are started, before they can watch and rebuild modules individually, making restarting them every few seconds time consuming
- **HTTP servers** - Sure, if you have a small server with only a few endpoints, restarting it every time you make a change may not be a big deal. However, if you have `WebSocket` instances connected to this server, they will disconnect every time you restart the app, whether or not the code you changed was actually related to the socket's endpoint or logic.

### Runners

Runners contain the main logic of a module. Once the persistent values have been created, the runner is responsible for interacting with these values, calling any setup functions and injecting old code. Runners are also responsible for removing these changes, essentially reverting any changes that they made.

### Mutating exports

This module provides a unique approach to updating the values exported by a module. Rather than just calling a callback provided by the module that imported the module that was changed and allowing that to handle updating any handlers of values, this module uses object mutation and `EventEmitter`s to provide the same effect.

Rather than simply returning the imported module's exports directly, the runtime will return an object with a single property, and will update that property with any changes that are made. In many cases, this completely removes the need for any sort of migration/upgrade code, as in most cases you can simply acess the exports via the mutated property directly (see the [`express` example](https://github.com/UpVotr/node-hmr/blob/main/examples/express/server.js#L34)).

### Optional asynchonous cycle

Another unique feature of this module is it's optional asynchronous features. While with other modules you would either need to enable top-level await or create code to handle uninitialized variables, this module allows you to provide asynchronous code for almost _any_ step of the module's life cycle, from creating persistent values to cleaning up after a runner. There is no need to worry about code being run before variables are defined, since a module's runner is guranteed to start _only_ after the persistient values have been initialized.

### Module caching

Module caches are only cleared for modules explicitly imported by the runtime, meaning that importing any other modules each time the module is updated has no performance impact. Imported HMR modules also have their own cache inside teh runtime (see [Error Handling](#error-handling)).

### Module life cycle

The basic steps that are taken when a module is imported by the runtime are as follows:

1. The runtime removes the module from the `require` cache, if it has been imported already.
2. The runtime then recompiles the module by `require`ing it again.
3. The runtime then checks to see if the exported value is a valid HMR module, and throws an error if it is not.
4. The runtime then checks the persistient values cache. If persistient values have not already been created for the module, the runtime waits for the module to set them up and saves them to the cache. If the values have already been created and the module is set to force them to update, the runtime waits for the last version of the module module to clean them up, then waits for the new module to create them again and saves the new values to the cache. Otherwise, the runtime continues with the cached values.
5. The runtime now runs and waits for the new module's runner inside a `try ... catch` block. If the runner throws an error, then the runtime attempts to run the last cached version of the module instead (see [Error Handling](#error-handling)). If this fails an error is thrown, otherwise a warning is logged to the console and the runtime continues with the old version of the module. If the runner does not throw an error, the new version of the module is cached as a backup for next time.
6. When the runtime's watcher detects a change in the module, the runner's cleanup function is called, removing any changes made to the persistient values, and the runtime starts again at step 1.

# API

#### `createModule(persist: PersistManager | null, runner: Runner | AsyncRunner, forceUpdate: boolean = false): HMRHodule` (alias: `hmr`)

The main way of creating an HMR-compatiable module. (You can still create the module definition object directly, see [HMRModule](#interface-hmrmodule))

- `persist` - A [`PersistManager`](#class-persistmanager) instance to manage persistient values that are costly to recreate or should not change such as runtimes, web servers, or compilers. Use `null` if you do not need persistient values. **See [`createPersist`](#createpersistgenerate-generate---p--promisep-cleanup-values-p--void--promisevoid)**.
- `runner` - A [`Runner`](#class-runnerp-extends-recordstring-any-e) or [`AsyncRunner`](#class-asyncrunnerp-extends-recordstring-any-e) instance that handles the main module logic, including importing other HMR-enabled modules. **See [`createRunner`](#createrunnerp-extends-recordstring-any-e-a-extends-boolean--falserun-persistentvalues-p-emitupdate---void--a-extends-true--promisee--e-cleanup-persistentvalues-p-exports-e--a-extends-true--void--promisevoid--void-----isasync-a--false-a-extends-true--asyncrunnerp-e--runnerp-e)**.

#### `createPersist(generate?: generate?: () => P | Promise<P>, cleanup?: (values: P) => void | Promise<void>)`

A simple function that creates a new `PersistManager`. Intended to make modules less verbose.

#### `createRunner<P extends Record<string, any>, E, A extends boolean = false>(run: (persistentValues: P, emitUpdate: () => void) => A extends true ? Promise<E> : E, cleanup: (persistentValues: P, exports: E) => A extends true ? void | Promise<void> : void = () => {}, isAsync: A = false): A extends true ? AsyncRunner<P, E> : Runner<P, E>`

<details style="opacity:0.5;user-select: none;">
<summary>Author's note</summary>
Oh boy, that's a nasty function signature.
</details>
A simple function that creates a new `Runner` or `AsyncRunner`. Intended to make modules less verbose, and consistient in format.

#### `createRuntime(require: NodeJS.Require, watcher: false | Watcher = new FSWatcher(require)): HMRruntime`

Simple wrapper around creating a new [`HMRRuntime`](#class-hmrruntime). (Arguments are intentionally switched as it makes more sense).

#### `class PersistManager<P extends Record<string, any>>`

> Prefer using [`createPersist`](#createpersistgenerate-generate---p--promisep-cleanup-values-p--void--promisevoid)

Responsible for managing persistient values. Only values that should not be expected to change or use large amounts of resources to recreate should be used in this class. For example, if you are importing other HMR-enabled modules, you would want to give your `HMRRuntime` to this class, since it should not be changed, but you most likely do not want to call `HMRRuntime.import` here.

##### `constructor(generate?: () => P | Promise<P>, cleanup?: (values: P) => void | Promise<void>)`

- `generate` - Responsible for generating the persistient values when they are updated. runs once before the `runner` is called, and whenever the runtime is instructed to update the persistient values for the module.
- `cleanup` - Responsible for handling any cleanup that needs to be done before the persistient values are regenerated, such as closing web servers or closing watchers for a `HMRRuntime` via the `closeAll` method. Only called when the runtime is instructed to update the persistient values.

##### `generate(): P | Promise<P>`

Simply calls the passed `generate` function, and returns the generated values.

##### `cleanup(values: P): void | Promise<void>`

Simply calls the passed `cleanup` function.

#### `class Runner<P extends Record<string, any>, E>`

> Prefer using [`createRunner`](#createrunnerp-extends-recordstring-any-e-a-extends-boolean--falserun-persistentvalues-p-emitupdate---void--a-extends-true--promisee--e-cleanup-persistentvalues-p-exports-e--a-extends-true--void--promisevoid--void-----isasync-a--false-a-extends-true--asyncrunnerp-e--runnerp-e)

Responsible for managing any non-persistient values and generating the module's exports value.

##### `constructor(run: (persistientValues: P, emitUpdate: () => void) => E, cleanup?: (persistientValues: P, exports: E) => void)`

- `run` - Manages the main logic of the module, including using any persistien values it needs, and returns the module's exports value. Note: returning a `Promise` with this function will set the module's exports to a `Promise`. To use an async function in the runner to load other HMR-enabled modules, use [`AsyncRunner`](#class-asyncrunnerp-extends-recordstring-any-e).
  - `persistientValues` - The current values of the `PersistManager` being used in the module.
  - `emitUpdate` - Generally shouldn't be used, but is used to manually send an `update` event to the runtime that is currently managing the module, allowing the code that imported this module to hadle any changes it may need to make or call any functions that may have changed, as shown in the example.
- `cleanup` - Responsible for _undoing_ any actions that the `run` function may have made to the environment or persistientValues in preperation for the next call to the updated `run` function.

#### `class AsyncRunner<P extends Record<string, any>, E>`

> Prefer using [`createRunner`](#createrunnerp-extends-recordstring-any-e-a-extends-boolean--falserun-persistentvalues-p-emitupdate---void--a-extends-true--promisee--e-cleanup-persistentvalues-p-exports-e--a-extends-true--void--promisevoid--void-----isasync-a--false-a-extends-true--asyncrunnerp-e--runnerp-e)

An version of `Runner` that allows you to use an `async` run function without setting the module's exports to a promise. Especially useful when importing other HMR-enabled modules inside the `run` function.

##### `constructor(run: (persistientValues: P, emitUpdate: () => void) => Promise<E>, cleanup?: (persistientValues: P, exports: E) => void | Promise<void>)`

- `run` - Exactly the same as the `run` function in the synchronous `Runner` class, with the exception that it is an asynchronous function or should return a promise that resolves with the module's exports.
- `cleanup` - Again, exactly the same as in the `Runner` class, but if it returns a `Promise` the runtime will wait for it to resolve before calling the `run` function of the updated module.

#### `class HMRRuntime`

> Prefer using [`createRuntime`](#createruntimerequire-nodejsrequire-watcher-false--watcher--new-fswatcherrequire-hmrruntime)

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
const { hmr, createRunner } = require("@upvotr/node-hmr");

module.exports = hmr(
  null,
  createRunner(() => {
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

- `constructor(require: NodeJS.Require)` - All sub-classes _should_ match this constructor pattern. Technically this can't be _forced_ but it is a pattern that is beneficial to keep. See the [CLI option](#cli-options) `-w`/`--watcher`. The passed require function `should really` only be used for resolving paths via `require.resolve`.

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

#### `createSyntheticRequire(require: (id: string) => any, realRequire: NodeJS.Require, cache?: any, resolve?: NodeJS.RequireResolve)` (alias: `synthetic`)

> Warning: This is an _experimental_ feature that may be removed in future versions, or completely overhauled.

This function creates a sort of mocked require function that can be used to modify imports. A great example of when you may want to use this is if you want to use this module with ESM exports. For example, if, in the example, you used `export default` and were working in a project with `"type": "module"`, the runtime would have no clue how to handle this new format, and even using the `createRequire` function provided by NodeJS's `module` module will not work, because it cannot import ESM. This is where this function comes in. Using this function, you can use a module such as `jiti` to synchronously import the modules. Example:

```ts
const createJITIRequire = require("jiti");
const { synthetic, createRuntime } = require("@upvotr/node-hmr");

const jiti = createJITIRequire(__filename);
const syntheticRequire = synthetic(
  (id) => jiti(id).default /* The default export is the HMRModule */,
  require,
  jiti.cache
);

const runtime = createRuntime(syntheticRequire);

async function main() {
  const es = await runtime.import("./esm.mjs");
  const ts = await runtime.import("./typescript.ts");

  es.exports();
  // Logs "Running from an ES Module!"
  ts.exports();
  // Logs "Running from a TypeScript Module!"
}

main();

// esm.mjs
import { hmr, createRunner } from "@upvotr/node-hmr";

export default hmr(
  null,
  createRunner(() => {
    return () => console.log("Running from an ES Module!");
  })
);

// typescript.ts
// Thanks to jiti, you can import typescript files, too!
import { hmr, createRunner } from "@upvotr/node-hmr";

export default hmr(
  null,
  createRunner(() => {
    return () => console.log("Running from a TypeScript Module!" as string);
  }),
  false
);
```

## Logging

Prior to version 3.0, all logging (little though there really is) was enabled forcefully. However, in 3.0 this has been changed.

Module update logging has been disabled by default. You can toggle it globally using `HMRRuntime.setLogging(log: boolean)`.
Module update warnings are enabled by default, but can be suppressed globally using `HMRRuntime.suppressWarnings(warn: boolean)`.

## Types

> A note on usage with TypeScript:
>
> TypeScript does not automatically detect a module's type when using `module.exports = hmr(...)`. To enable type inferencing and the `ExportType` type, use `export = hmr(...)` instead, or see [`createSyntheticRequire`](#createsyntheticrequirerequire-id-string--any-realrequire-nodejsrequire-cache-any-resolve-nodejsrequireresolve) to use `export default`.

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

##### Note: As of version 3.0, the types are set up to automatically detect `HMRModule`s and use `ExportType` automatically.

As such, the following works just as well, if not better:

```ts
const mod = await runtime.import<typeof import("./path/to/module")>(
  "./path/to/module"
);
```

## CLI

Version 3.0 comes with a brand-new CLI feature! It was designed to elimnate the previous requirement of having a small entry file that did something similar to the following:

```js
import { createRuntime } from "@upvotr/node-hmr";

createRuntime(require).import("./real-entry.js");
```

Usage:

```
hmr [options]
```

### CLI Options

- `-w`, `--watcher`
  - Path to a module containing a `Watcher` class, which the CLI will use for the runtime. If no runtime is specefied, the provided `FSWatcher` is used. The constructor is passed a single argument: The synthetic `require` that is generated by the cli. See [`Watcher`](#abstract-class-watcher).
- `-n`, `--noWatch`
  - Disable module watching/reloading. Useful for running in production environments.
- `-l`, `--enableLogging`
  - Enble module update logging.
- `-s`, `--suppressWarnings`
  - Suppress warning output.
- `-r`, `--require`
  - Path to a module containing a custom `require` function. The file _must_ be a CommonJS module. Note that the CLI will create a synthetic require from this function, replasing the `resolve` function. This can be used with `createSyntheticRequire`, external require functions such as `jiti`, or `require` hooks such as `@babel/register`. When using `require` hooks, simply re-export the tapped function:
    ```js
    require("@babel/register")({
      // configuration here
    });
    module.exports = require;
    ```
- `-f`, `--file`
  - Path to the HMR module to run.

## Disabling HMR for Production

HMR is extremely useful for development, but in production builds it is an unnecessary use of resources. This module was designed with this in mind!

### 2.0+ methods (still supported):

There are two ways to disable it: Either pass `false` for the `watcher` parameter for each runtime (reccomended), or use the provided `NoopWatcher` watcher. Example:

```js
// Because the `&&` operator returns either the first falsy value or the last value, this will evaluate to `false` if `NODE_ENV` is anything but "development", and will return a watcher otherwise.
const runtime = new createRuntime(
  require,
  process.env.NODE_ENV === "development" && new Watcher()
);
```

### 3.0+ version

Disabling module reloading can now be done globally in version 3. Simply call the `HMRRuntime.disableReloading` function. Note that this cannot be undone at runtime.

```js
if (process.env.NODE_ENV === "production") HMRRuntime.disableReloading();
```

### With the CLI

Disabling HMR is even simpler with the CLI added in vresion 3.0. Simply add the `-n` or `--noWatch` flag!

## Error Handling

You're never going to be perfect. Sometimes you'll have a syntax error, or some small issue you forgot to fix. However, you don't want one of these small issues to completely destroy your development process by having to pause to restart the server. This module attempts to prevent this from happening. If a module encounters an error when the runner is called, the runtime notices this error, and attemps to reinstate the module by calling a chached runner from the previous time it was imported and run without an error, and will log a warning to the console. If the module has _not_ been cached, as this was the first import, _or_ the last cached version produces an error, _then_ the runtime will throw an error.
