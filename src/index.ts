/* ---------------------------------- Types --------------------------------- */
import { HotModule, ExportType } from "./exportTypes";

export type { HotModule, ExportType };

/* --------------------------------- Classes -------------------------------- */
import { Watcher } from "./watcher.js";
import { FSWatcher } from "./fsWatcher.js";
import { NoopWatcher } from "./noopWatcher.js";
import { HMRRuntime } from "./runtime.js";
import { AsyncRunner, Runner } from "./runner.js";
import { PersistManager } from "./persistManager.js";

export {
  Watcher,
  HMRRuntime,
  FSWatcher,
  NoopWatcher,
  AsyncRunner,
  Runner,
  PersistManager
};

export default HMRRuntime;

/* --------------------------------- Utility -------------------------------- */
import { createSyntheticRequire } from "./createRequire.js";
import { createModule } from "./createModule.js";

const hmr = createModule;
const synthetic = createSyntheticRequire;

const createRunner = <
  P extends Record<string, any>,
  E,
  A extends boolean = false
>(
  run: (
    persistentValues: P,
    emitUpdate: () => void
  ) => A extends true ? Promise<E> : E,
  cleanup: (
    persistentValues: P,
    exports: E
  ) => A extends true ? void | Promise<void> : void,
  isAsync: A = false as A
): A extends true ? AsyncRunner<P, E> : Runner<P, E> =>
  (!!isAsync
    ? new AsyncRunner(run as any, cleanup)
    : new Runner(run as any, cleanup)) as any;

const createPersist = <P extends Record<string, any>>(
  generatePersistentValues: () => Promise<P> | P = () => ({} as P),
  cleanupPersistentValues: (
    persistentValues: P
  ) => Promise<void> | void = () => {}
) => new PersistManager(generatePersistentValues, cleanupPersistentValues);

const runtime = (require: NodeJS.Require, watcher: false | Watcher) =>
  new HMRRuntime(watcher, require);

export {
  createSyntheticRequire,
  createModule,
  hmr,
  synthetic,
  createRunner,
  createPersist,
  runtime
};
