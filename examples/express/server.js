const express = require("express");
const { Router } = express;
const {
  HMRRuntime,
  createModule,
  PersistManager,
  AsyncRunner,
  FSWatcher
} = require("@upvotr/node-hmr");

module.exports = createModule(
  new PersistManager(
    () => {
      const app = express();
      const server = app.listen(3000);
      return {
        runtime: new HMRRuntime(new FSWatcher(require), require),
        app,
        server
      };
    },
    ({ runtime, server }) => {
      runtime.closeAll();
      server.close();
    }
  ),
  new AsyncRunner(
    async ({ runtime, app }) => {
      const router = Router();
      const foo = await runtime.import("./routes/foo.js");
      const bar = await runtime.import("./routes/bar.js");

      // For these, we'll simply use the mutating property `exports`
      router.use("/foo", (...args) => foo.exports(...args));
      router.use("/bar", (...args) => bar.exports(...args));

      // Notice that we are *not* using the same pattern as with the router. That pattern could still be used
      // but, since the app's internal router is not reset every time like the router variable, we have to clear
      // it ourselves, so the pattern is unecessary.
      app.use(router);
    },
    ({ runtime, app }) => {
      runtime.unimport("./routes/foo.js");
      runtime.unimport("./routes/bar.js");
      // This clears all of the listeners on the app so that we can reinstate them on an update
      app._router.stack = [];
    }
  ),
  false
);
