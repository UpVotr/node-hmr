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
