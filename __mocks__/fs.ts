import { jest } from "@jest/globals";
import EventEmitter from "events";
import type { FSWatcher } from "fs";

const fs: typeof import("fs") = jest.createMockFromModule("fs");

const mockWatchEmitter = new EventEmitter();

const watch: typeof fs["watch"] = (filename, listener) => {
  const mocklistener = (type: "change" | "rename", changedFile: string) => {
    if (changedFile === filename) listener(type, changedFile);
  };
  const emitter: FSWatcher = Object.assign(new EventEmitter(), {
    close: () => {
      mockWatchEmitter.off("change", mocklistener);
    }
  });
  mockWatchEmitter.on("change", mocklistener);

  return emitter;
};

const mockFS = Object.assign(fs, {
  watch,
  __emitFileChange(type: "change" | "rename", filename: string) {
    mockWatchEmitter.emit("change", type, filename);
  }
});

export default mockFS;
