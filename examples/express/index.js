const { HMRRuntime, FSWatcher } = require("@upvotr/node-hmr");

const runtime = new HMRRuntime(new FSWatcher(require), require);

// We don't interact with the app here, so all we need to do is import it.
runtime.import("./server.js");
