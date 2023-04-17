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
