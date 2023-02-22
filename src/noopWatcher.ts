import { Watcher } from "./watcher";

/**
 * For production versions, so you don't need to rewrite your code
 */
export class NoopWatcher extends Watcher {
  watch(id: string): () => void {
    return () => {};
  }
}
