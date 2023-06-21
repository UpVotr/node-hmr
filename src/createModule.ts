import { HotModule } from "./exportTypes";
import { PersistManager } from "./persistManager";
import { AsyncRunner, Runner } from "./runner";

export const createModule = <P extends Record<string, any>, E extends any>(
  persist: PersistManager<P>,
  runner: Runner<P, E> | AsyncRunner<P, E>,
  forceUpdate: boolean = false
): HotModule<P, E> => {
  return {
    updatePersistentValues: forceUpdate,
    persist,
    runner
  };
};
