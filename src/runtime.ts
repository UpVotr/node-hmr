import chalk from "chalk";
import { ExportType, HotModule, isValidHotModule } from "./exportTypes.js";
import { Watcher } from "./watcher.js";
import { FSWatcher } from "./fsWatcher.js";
import EventEmitter from "events";
import { AsyncRunner } from "./runner.js";

export class HMRRuntime extends EventEmitter {
  static get HMRRuntime() {
    return HMRRuntime;
  }

  private _cache: Record<string, any>;

  private persistentCache: Record<string, any>;
  private exportCache: Record<string, { exports: any }>;
  private moduleCache: Record<string, HotModule<any, any>>;
  private unwatchCache: Record<string, () => void>;
  private listenerCache: Record<string, (id: string) => void>;
  private invalidatedModules: Set<string>;

  constructor(
    private watcher: Watcher | false,
    private _requireFn: NodeJS.Require
  ) {
    super();
    this._cache = Object.create(null);
    this.persistentCache = Object.create(null);
    this.exportCache = Object.create(null);
    this.moduleCache = Object.create(null);
    this.unwatchCache = Object.create(null);
    this.listenerCache = Object.create(null);
    this.invalidatedModules = new Set();
  }

  private invalidateModule(id: string) {
    this.invalidatedModules.add(id);
  }

  private cacheBustRequire(id: string): any {
    if (id in this._cache && !this.invalidatedModules.has(id)) {
      return this._cache[id];
    }
    this.invalidatedModules.delete(id);
    if (!this._requireFn) return undefined;
    try {
      const resolvedPath = this._requireFn.resolve(id);
      if (resolvedPath in this._requireFn.cache)
        delete this._requireFn.cache[resolvedPath];
      return (this._cache[id] =
        this._requireFn(resolvedPath) || this._cache[id]);
    } catch (e) {
      console.error(
        chalk.redBright.bold(`Error in import of file ${id}:`),
        chalk.red(e)
      );
      if (id in this._cache) {
        if (!HMRRuntime.shouldSuppressWarnings())
          chalk.yellow("Using cached import.");
        return this._cache[id];
      }
      console.error(chalk.red("No cached import found, unable to continue!"));
      throw e;
    }
  }

  private async handleModuleUpgrade(id: string, m: HotModule<any, any>) {
    if (!(id in this.persistentCache) || m.updatePersistentValues) {
      if (m.updatePersistentValues && id in this.moduleCache) {
        const cleanup = this.moduleCache[id].persist.cleanup(
          this.persistentCache[id]
        );
        if (cleanup instanceof Promise) await cleanup;
      }

      const persistient = m.persist.generate();
      if (persistient instanceof Promise) {
        this.persistentCache[id] = await persistient;
      } else {
        this.persistentCache[id] = persistient;
      }
    }

    if (id in this.moduleCache) {
      try {
        this.moduleCache[id].runner.clean(
          this.persistentCache[id],
          this.exportCache[id].exports
        );
      } catch (e) {
        console.error(
          chalk.redBright.bold(`Error cleaning up module ${id}:`, chalk.red(e))
        );
        if (!HMRRuntime.shouldSuppressWarnings())
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
      const params = [
        this.persistentCache[id],
        () => this.emit("update", id)
      ] as const;
      let exports: any;
      if (m.runner instanceof AsyncRunner) {
        exports = await m.runner.execute(...params);
      } else {
        exports = m.runner.execute(...params);
      }
      this.exportCache[id].exports = exports;
    } catch (e) {
      console.error(
        chalk.redBright.bold(`Error running module ${id}:`, chalk.red(e))
      );
      throw e;
    }
  }

  async import<E = any>(
    id: string
  ): Promise<{
    exports: (E extends HotModule<any, any> ? ExportType<E> : E) | undefined;
  }> {
    const m = this.cacheBustRequire(id);
    if (!isValidHotModule(m))
      throw new TypeError(`Invalid hot module export for import ${id}!`);

    await this.handleModuleUpgrade(id, m);
    if (typeof this.watcher !== "boolean" && !HMRRuntime.watchDisabled())
      this.unwatchCache[id] = this.watcher.watch(id);
    const listener = (...files: string[]) => {
      if (files.includes(id)) {
        if (HMRRuntime.loggingEnabled())
          console.log(
            chalk.blueBright(
              `Module ${id} updated! clearing cache and updating exports...`
            )
          );
        this.invalidateModule(id);

        this.handleModuleUpgrade(id, this.cacheBustRequire(id)).then(() => {
          this.emit("update", id);
        });
      }
    };
    this.listenerCache[id] = listener;
    if (typeof this.watcher !== "boolean" && !HMRRuntime.watchDisabled())
      this.watcher.on("update", listener);

    return this.exportCache[id];
  }

  unimport(id: string) {
    this.unwatchCache[id]?.();
    if (typeof this.watcher !== "boolean" && !HMRRuntime.watchDisabled())
      this.watcher.off("update", this.listenerCache[id]);
    delete this.unwatchCache[id];
    delete this._cache[id];
    this.moduleCache[id]?.persist.cleanup(this.persistentCache[id]);
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
      if (typeof this.watcher !== "boolean" && !HMRRuntime.watchDisabled())
        this.watcher.off("update", this.listenerCache[id]);
      delete this.unwatchCache[id];
    }
  }
}

export namespace HMRRuntime {
  let logging = false;

  export const setLogging = (log: boolean) => void (logging = !!log);

  export const loggingEnabled = () => logging;

  let suppressWarn = false;

  export const suppressWarnings = (warn: boolean) =>
    void (suppressWarn = !!warn);

  export const shouldSuppressWarnings = () => suppressWarnings;

  let noWatch = false;
  export const disableWatching = () => void (noWatch = true);
  export const watchDisabled = () => noWatch;
}
