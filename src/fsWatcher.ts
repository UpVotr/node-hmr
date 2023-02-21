import { Watcher } from "./watcher.js";
import fs from "fs";

export class FSWatcher extends Watcher {
  watch(id: string): () => void {
    let timeout: NodeJS.Timeout;
    return fs.watch(id, () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.emit("update", id);
      }, 1000);
    }).close;
  }
}
