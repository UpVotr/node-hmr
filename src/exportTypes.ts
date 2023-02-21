export interface HotModule<P extends Record<string | symbol, any>, E> {
  /**
   * This code is only run on the first require, or if
   * {@link HotModule.updatePersistentValues updatePersistentValues} is true.
   */
  getPersistentValues(): P | Promise<P>;
  /**
   * Whether or not to update persistent values.
   */
  updatePersistentValues?: boolean;
  /**
   * Main body of the module. Runs after the file has been updated.
   * @param persistentValues - The return value of the last call of
   * {@link HotModule.getPersistentValues getPersistentValues}.
   */
  run(
    persistentValues: P,
    emitUpdate: () => void
  ): E | { __hmrIsPromise: true; promise: Promise<E> };
  /**
   * Responsible for removing the code that was injected by
   * {@link HotModule.run run} to prepare for the new module.
   * @param persistentValues - The return value of the last call of
   * {@link HotModule.getPersistentValues getPersistentValues}.
   */
  cleanup(persistentValues: P, exports: E): void | Promise<void>;
  /**
   * Responsible for hadnling any cleanup that is required for updating
   * persistent values when {@link updatePersistentValues updatePersistentValues}
   * is true.
   * @param persistentValues - The return value of the last call of
   * {@link HotModule.getPersistentValues getPersistentValues}.
   */
  cleanupPersistentValues(persistentValues: P): void | Promise<void>;
}

export function isValidHotModule(m: any): m is HotModule<any, any> {
  return (
    [
      "cleanup",
      "cleanupPersistentValues",
      "getPersistentValues",
      "run"
    ] as (keyof HotModule<any, any>)[]
  ).every((ex) => ex in m);
}
