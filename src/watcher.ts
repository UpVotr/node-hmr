import EventEmitter from "events";

export abstract class Watcher extends EventEmitter {
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
}
