export interface HotModule<T> {
  /**
   * This code is only run on the first require, or if
   * {@link HotModule.updatePersistentValues updatePersistentValues} is true.
   */
  getPersistentValues(): T;
  /**
   * Whether or not to update persistent values.
   */
  updatePersistentValues?: boolean;
  /**
   * Main body of the module. Runs after the file has been updated.
   * @param persistentValues - The return value of the last call of
   * {@link HotModule.getPersistentValues getPersistentValues}.
   */
  run(persistentValues: T): void;
  /**
   * Responsible for removing the code that was injected by
   * {@link HotModule.run run} to prepare for the new module.
   * @param persistentValues
   */
  cleanup(persistentValues: T): void;
}
