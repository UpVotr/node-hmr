import { Watcher } from "./watcher.js";
import fs from "fs";

export class FSWatcher extends Watcher {
  constructor(private require: NodeJS.Require) {
    super();
  }

  watch(id: string): () => void {
    let timeout: NodeJS.Timeout;
    const watcher = fs.watch(this.require.resolve(id), () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.emit("update", id);
      }, 1000);
    });

    return () => watcher.close();
  }
}
