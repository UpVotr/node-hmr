# node-hmr

Hot module reloading for node.js with persistent values

> A result of trying to develop Next.js applications with custom servers on a slow computer.

## Installation

npm

```
npm i @upvotr/node-hmr
```

yarn

```
yarn add @upvotr/node-hmr
```

## Usage

> note: This module is _not_ intended for use when changing/updating modules in `node_modules`, and will not work correctly if you attempt to.

A minimal example:

```js
// index.js
const { HMRRuntime, FSWatcher } = require("@upvotr/node-hmr");

const runtime = new HMRRuntime(new FSWatcher(), require);

async function main() {
  const a = await runtime.import("./a.js");

  a.exports.foo();

  runtime.on("update", (moduleId) => {
    if (moduleId === "./a.js") a.exports.foo();
  });
}

main();

// a.js
const { HMRRuntime, FSWatcher } = require("@upvotr/node-hmr");

const moduleADef = {
  getPersistentValues() {
    return {
      runtime: new HMRRuntime(new FSWatcher(), require)
    };
  },

  run({ runtime }, emitUpdate) {
    const loadAndRun = async () => {
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
    };

    return {
      __hmrIsPromise: true,
      promise: loadAndRun()
    };
  },

  cleanup({ runtime }) {
    // Stop watching the file
    runtime.unimport("./b.js");
  },

  cleanupPersistentValues({ runtime }) {
    runtime.closeAll();
  }
};

module.exports = moduleADef;

// b.js
const moduleBDef = {
  getPersistentValues() {},

  run() {
    return {
      bar: () => console.log("baz")
    };
  },

  cleanup() {},

  cleanupPersistentValues() {}
};

module.exports = moduleBDef;
```

Running `node index.js` will run `main`, which listens for updates from the `a.js` file. Changing `"baz"` to a different value will automatically update the module, and it will be logged in the console again!

# API

> Documentation pending
