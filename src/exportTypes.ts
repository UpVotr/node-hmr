import { PersistManager } from "./persistManager";
import { AsyncRunner, Runner } from "./runner";

export interface HotModule<P extends Record<string | symbol, any>, E> {
  updatePersistentValues?: boolean;

  persist: PersistManager<P>;
  runner: Runner<P, E> | AsyncRunner<P, E>;
}

export type ExportType<M extends HotModule<any, any>> = M["runner"] extends
  | Runner<any, infer E>
  | AsyncRunner<any, infer E>
  ? E
  : any;

export function isValidHotModule(m: any): m is HotModule<any, any> {
  return (
    "persist" in m &&
    m.persist instanceof PersistManager &&
    "runner" in m &&
    (m.runner instanceof Runner || m.runner instanceof AsyncRunner)
  );
}
