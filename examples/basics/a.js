const {
  hmr,
  createPersist,
  createRunner,
  createRuntime
} = require("@upvotr/node-hmr");

module.exports = hmr(
  createPersist(
    () => ({
      runtime: createRuntime(require)
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
    // Mark as AsyncRunner
    true
  )
);
