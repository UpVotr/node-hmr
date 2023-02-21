import chalk from "chalk";
import { HotModule, isValidHotModule } from "./exportTypes.js";
import { Watcher } from "./watcher.js";
import { FSWatcher } from "./fsWatcher.js";
import EventEmitter from "events";

export class HMRRuntime extends EventEmitter {
  static get HMRRuntime() {
    return HMRRuntime;
  }

  private _cache: Record<string, any>;
  private _requireFn?: NodeJS.Require;

  private persistentCache: Record<string, any>;
  private exportCache: Record<string, { exports: any }>;
  private moduleCache: Record<string, HotModule<any, any>>;
  private unwatchCache: Record<string, () => void>;
  private invalidatedModules: Set<string>;

  constructor(
    private watcher: Watcher | boolean = new FSWatcher(),
    requireFn?: NodeJS.Require
  ) {
    super();
    this._requireFn =
      requireFn || (typeof require !== "undefined" ? require : undefined);
    this._cache = Object.create(null);
    this.persistentCache = Object.create(null);
    this.exportCache = Object.create(null);
    this.moduleCache = Object.create(null);
    this.unwatchCache = Object.create(null);
    this.invalidatedModules = new Set();
  }

  private invalidateModule(id: string) {
    this.invalidatedModules.add(id);
  }

  private async cacheBustRequire(id: string): Promise<any> {
    if (id in this._cache && !this.invalidatedModules.has(id)) {
      return this._cache[id];
    }
    this.invalidatedModules.delete(id);
    if (this._requireFn) {
      try {
        return this.cacheBustCjs(id);
      } catch (e: any) {
        if ("code" in e && e.code === "ERR_REQUIRE_ESM") {
          return this.cacheBustEsm(id);
        }

        throw e;
      }
    } else {
      return this.cacheBustEsm(id);
    }
  }

  private showEsmLeakWarn = true;

  private async cacheBustEsm(id: string): Promise<any> {
    if (this.showEsmLeakWarn) {
      console.warn(
        chalk.yellow.bold(
          "Cache busting using ESM modules causes " +
            "memory leaks due to the inability to clear the cache. You may want to " +
            "restart the process every once in a while."
        )
      );
      this.showEsmLeakWarn = false;
    }
    try {
      return (this._cache[id] = (
        await import(`${id}?cacheBust=${Date.now()}`)
      ).default);
    } catch (e) {
      console.error(
        chalk.redBright.bold(`Error in import of file ${id}:`),
        chalk.red(e)
      );
      if (id in this._cache) {
        chalk.yellow("Using cached import.");
        return this._cache[id];
      }
      console.error(
        chalk.yellow("No cached import found, unable to continue!")
      );
      throw e;
    }
  }

  private cacheBustCjs(id: string): any {
    if (!this._requireFn) return undefined;
    try {
      if (id in this._cache) delete this._requireFn.cache[id];
      return (this._cache[id] = this._requireFn(id));
    } catch (e) {
      console.error(
        chalk.redBright.bold(`Error in import of file ${id}:`),
        chalk.red(e)
      );
      if (id in this._cache) {
        chalk.yellow("Using cached import.");
        return this._cache[id];
      }
      console.error(
        chalk.yellow("No cached import found, unable to continue!")
      );
      throw e;
    }
  }

  private async handleModuleUpgrade(id: string, m: HotModule<any, any>) {
    if (!(id in this.persistentCache) || m.updatePersistentValues) {
      if (m.updatePersistentValues && id in this.moduleCache) {
        const cleanup = this.moduleCache[id].cleanupPersistentValues(
          this.persistentCache[id]
        );
        if (cleanup instanceof Promise) await cleanup;
      }

      const persistient = m.getPersistentValues();
      if (persistient instanceof Promise) {
        this.persistentCache[id] = await persistient;
      } else {
        this.persistentCache[id] = persistient;
      }
    }

    if (id in this.moduleCache) {
      try {
        this.moduleCache[id].cleanup(
          this.persistentCache[id],
          this.exportCache[id]
        );
      } catch (e) {
        console.error(
          chalk.redBright.bold(`Error cleaning up module ${id}:`, chalk.red(e))
        );
        console.warn(chalk.yellow("Unable to continue!"));
        throw e;
      }
    }

    this.moduleCache[id] = m;

    if (!(id in this.exportCache)) {
      this.exportCache[id] = {
        exports: undefined
      };
    }

    try {
      const runReturn = m.run(this.persistentCache[id], () =>
        this.emit("update", id)
      );
      let exports: any;
      if (runReturn.__hmrIsPromise === true) {
        exports = await runReturn.promise;
      } else {
        exports = runReturn;
      }
      this.exportCache[id].exports = exports;
    } catch (e) {
      console.error(
        chalk.redBright.bold(`Error running module ${id}:`, chalk.red(e))
      );
      console.warn(chalk.yellow("Unable to continue!"));
      throw e;
    }
  }

  async import<E = any>(id: string): Promise<{ exports: E | undefined }> {
    const m = await this.cacheBustRequire(id);
    if (!isValidHotModule(m))
      throw new TypeError(`Invalid hot module export for import ${id}!`);

    await this.handleModuleUpgrade(id, m);
    if (typeof this.watcher !== "boolean")
      this.unwatchCache[id] = this.watcher.watch(id);
    const listener = (...files: string[]) => {
      if (files.includes(id)) {
        console.log(
          chalk.blueBright(
            `Module ${id} updated! clearing cache and updating exports...`
          )
        );
        this.invalidateModule(id);
        this.cacheBustRequire(id).then((m) => {
          this.handleModuleUpgrade(id, m).then(() => {
            this.emit("update", id);
          });
        });
      }
    };
    if (typeof this.watcher !== "boolean") this.watcher.on("update", listener);

    return this.exportCache[id];
  }

  unimport(id: string) {
    this.unwatchCache[id]?.();
    delete this.unwatchCache[id];
    delete this._cache[id];
    this.moduleCache[id]?.cleanupPersistentValues(this.persistentCache[id]);
    delete this.moduleCache[id];
    delete this.exportCache[id];
    delete this.persistentCache[id];
  }

  on(eventName: "update", listener: (...paths: string[]) => void): this {
    return super.on(eventName, listener);
  }
  off(eventName: "update", listener: (...paths: string[]) => void): this {
    return super.off(eventName, listener);
  }
  once(eventName: "update", listener: (...paths: string[]) => void): this {
    return super.once(eventName, listener);
  }
  emit(eventName: "update", ...args: string[]): boolean {
    return super.emit(eventName, ...args);
  }

  closeAll() {
    for (const id in this.unwatchCache) {
      this.unwatchCache[id]();
      delete this.unwatchCache[id];
    }
  }
}
