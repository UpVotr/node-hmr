import HMRRuntime, { FSWatcher } from "@upvotr/node-hmr";
import { createRequire } from "module";

const moduleADef = {
  getPersistentValues() {
    return {
      runtime: new HMRruntime(new FSWatcher(), createRequire(import.meta.url))
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

export default moduleADef;
